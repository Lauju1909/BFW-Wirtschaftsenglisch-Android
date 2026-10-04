using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;

namespace BFWVocabManagerApp
{
    static class Program
    {
        private const int BASE_PORT = 48250;
        private static int _activePort = BASE_PORT;
        private static TcpListener _tcpListener;
        private static Thread _serverThread;
        private static volatile bool _isRunning = true;
        private static string _htmlContent;

        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                // 1. Eingebettete HTML laden oder aus Datei lesen
                LoadAppHtml();

                // 2. Lokalen TCP Server starten (Zero Firewall Prompts)
                bool serverStarted = StartLocalServer();
                if (!serverStarted)
                {
                    for (int p = BASE_PORT + 1; p < BASE_PORT + 25; p++)
                    {
                        if (TryStartServerOnPort(p)) { serverStarted = true; break; }
                    }
                }

                string url = string.Format("http://127.0.0.1:{0}/", _activePort);

                // 3. Browser im App-Fenster-Modus starten
                LaunchAppBrowser(url);

                // 4. Server aktiv halten
                while (_isRunning)
                {
                    Thread.Sleep(1000);
                }
            }
            catch (Exception ex)
            {
                try
                {
                    File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "crash_log.txt"), ex.ToString());
                }
                catch { }
            }
        }

        private static void LoadAppHtml()
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                using (var stream = asm.GetManifestResourceStream("BFWVocabManagerApp.embedded_app.html"))
                {
                    if (stream != null)
                    {
                        using (var reader = new StreamReader(stream, Encoding.UTF8))
                        {
                            _htmlContent = reader.ReadToEnd();
                            return;
                        }
                    }
                }
            }
            catch { }

            string localHtml = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "BFW_VokabelVerwaltung_App.html");
            if (File.Exists(localHtml))
            {
                _htmlContent = File.ReadAllText(localHtml, Encoding.UTF8);
            }
            else
            {
                string wwwIndex = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "www", "index.html");
                if (File.Exists(wwwIndex))
                {
                    _htmlContent = File.ReadAllText(wwwIndex, Encoding.UTF8);
                }
                else
                {
                    _htmlContent = "<!DOCTYPE html><html><body><h1>BFW Vokabel-Verwaltung</h1><p>HTML-Ressourcen werden geladen...</p></body></html>";
                }
            }
        }

        private static bool StartLocalServer()
        {
            return TryStartServerOnPort(BASE_PORT);
        }

        private static bool TryStartServerOnPort(int port)
        {
            try
            {
                _tcpListener = new TcpListener(IPAddress.Loopback, port);
                _tcpListener.Start();
                _activePort = port;

                _serverThread = new Thread(ServerWorkerLoop)
                {
                    IsBackground = true,
                    Name = "BFWVocabServer"
                };
                _serverThread.Start();
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static void ServerWorkerLoop()
        {
            while (_isRunning)
            {
                try
                {
                    TcpClient client = _tcpListener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClientConnection, client);
                }
                catch
                {
                    if (!_isRunning) break;
                }
            }
        }

        private static void HandleClientConnection(object state)
        {
            TcpClient client = state as TcpClient;
            if (client == null) return;

            try
            {
                using (NetworkStream stream = client.GetStream())
                {
                    stream.ReadTimeout = 4000;
                    stream.WriteTimeout = 4000;

                    byte[] buffer = new byte[8192];
                    int bytesRead = stream.Read(buffer, 0, buffer.Length);
                    if (bytesRead <= 0) return;

                    string request = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                    string[] lines = request.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
                    if (lines.Length == 0) return;

                    string firstLine = lines[0];
                    string[] tokens = firstLine.Split(' ');
                    if (tokens.Length < 2) return;

                    string method = tokens[0].ToUpperInvariant();
                    string rawPath = tokens[1].Split('?')[0];

                    if (rawPath == "/" || rawPath == "/index.html")
                    {
                        byte[] htmlBytes = Encoding.UTF8.GetBytes(_htmlContent ?? "");
                        SendHttpResponse(stream, "200 OK", "text/html; charset=utf-8", htmlBytes);
                        return;
                    }

                    // Static file fallback from www
                    string localFilePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "www", rawPath.TrimStart('/'));
                    if (File.Exists(localFilePath))
                    {
                        byte[] fileBytes = File.ReadAllBytes(localFilePath);
                        string mime = GetMimeType(localFilePath);
                        SendHttpResponse(stream, "200 OK", mime, fileBytes);
                        return;
                    }

                    // Default to main HTML
                    byte[] defaultBytes = Encoding.UTF8.GetBytes(_htmlContent ?? "");
                    SendHttpResponse(stream, "200 OK", "text/html; charset=utf-8", defaultBytes);
                }
            }
            catch { }
            finally
            {
                try { client.Close(); } catch { }
            }
        }

        private static void SendHttpResponse(NetworkStream stream, string status, string contentType, byte[] body)
        {
            StringBuilder sb = new StringBuilder();
            sb.AppendFormat("HTTP/1.1 {0}\r\n", status);
            sb.AppendFormat("Content-Type: {0}\r\n", contentType);
            sb.AppendFormat("Content-Length: {0}\r\n", body.Length);
            sb.Append("Connection: close\r\n");
            sb.Append("Access-Control-Allow-Origin: *\r\n");
            sb.Append("\r\n");

            byte[] headerBytes = Encoding.ASCII.GetBytes(sb.ToString());
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }

        private static string GetMimeType(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".ico": return "image/x-icon";
                default: return "application/octet-stream";
            }
        }

        private static void LaunchAppBrowser(string url)
        {
            // 1. Edge im App-Modus
            string edgePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe");
            if (!File.Exists(edgePath))
            {
                edgePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe");
            }

            if (File.Exists(edgePath))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = edgePath,
                    Arguments = string.Format("--app=\"{0}\" --window-size=1100,800", url),
                    UseShellExecute = true
                });
                return;
            }

            // 2. Chrome
            string chromePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe");
            if (File.Exists(chromePath))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = chromePath,
                    Arguments = string.Format("--app=\"{0}\" --window-size=1100,800", url),
                    UseShellExecute = true
                });
                return;
            }

            // 3. Fallback Standard-Browser
            Process.Start(new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
        }
    }
}
