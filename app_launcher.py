import os
import sys
import webbrowser

def main():
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    
    html_file = os.path.join(base_path, "BFW_VokabelVerwaltung_App.html")
    webbrowser.open("file://" + os.path.abspath(html_file).replace("\\", "/"))

if __name__ == '__main__':
    main()
