import socket
import tkinter as tk
import ftplib
import subprocess
from smb.SMBConnection import SMBConnection



class NetworkScanner:
    def __init__(self, master):
        self.master = master
        master.title("Network Scanner")

        #Ip Address field
        self.ip_label = tk.Label(master, text="IP Address:")
        self.ip_label.pack()
        self.ip_entry = tk.Entry(master)
        self.ip_entry.pack()

        self.scan_types = ["Normal Scan", "Ports Scan", "OS Detection", "SMB Enumeration", "FTP Enumeration"]
        self.selected_scan_type = tk.StringVar(master)
        self.selected_scan_type.set(self.scan_types[0])  # Default scan type

        self.scan_type_menu = tk.OptionMenu(master, self.selected_scan_type, *self.scan_types)
        self.scan_type_menu.pack()

        self.scan_button = tk.Button(master, text="Start Scan", command=self.start_scan)
        self.scan_button.pack()

        # Widget di testo per visualizzare l'output della scansione delle porte
        self.output_text = tk.Text(master, height=10, width=50)
        self.output_text.pack()

    def start_scan(self):
        selected_type = self.selected_scan_type.get()
        ip_address = self.ip_entry.get()  # Ottiene l'indirizzo IP inserito dall'utente
        if selected_type == "Normal Scan":
            self.normal_scan(ip_address)
        elif selected_type == "Ports Scan":
            self.ports_scan(ip_address)
        elif selected_type == "OS Detection":
            self.os_detection(ip_address)
        elif selected_type == "SMB Enumeration":
            self.smb_enum(ip_address)
        elif selected_type == "FTP Enumeration":
            self.ftp_enum(ip_address)

    def normal_scan(self, ip_address):
        #managing of the output texts section of tk (cleaning + new scanning text)
        self.output_text.delete("1.0", tk.END)
        self.output_text.insert(tk.END, f"Scanning common ports on {ip_address}...\n\n")

        target_ports = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 3389]
        print(f"Scanning {ip_address}...")
        for port in target_ports:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)


                result = sock.connect_ex((ip_address, port))
                if result == 0:
                    print(f"Port {port} is open")
                else:
                    print(f"Port {port} is closed")
                sock.close()
            except Exception as e:
                print(f"Error scanning port {port}: {e}")

    def ports_scan(self, ip_address):
        # managing of the output texts section of tk (cleaning + new scanning text)
        self.output_text.delete("1.0", tk.END)
        self.output_text.insert(tk.END, f"Ports scan on {ip_address}...\n\n")



        target_ports = range(1, 1025)  # Scanning ports 1/1024


        for port in target_ports:
            try:
                # Creazione del socket TCP
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex((ip_address, port))
                if result == 0:
                    print(f"Port {port} is open")
                else:
                    print(f"Port {port} is closed")
                sock.close()
            except Exception as e:
                print(f"Error scanning port {port}: {e}")


    def smb_enum(self, ip_address):
        # Gestione della sezione di output della GUI (pulizia + nuovo testo di scansione)
        self.output_text.delete("1.0", tk.END)
        self.output_text.insert(tk.END, f"SMB Enumeration on {ip_address}...\n\n")

        try:
            #Connection to SMB server
            conn = SMBConnection('guest', '', 'my_client', ip_address, use_ntlm_v2=True)
            conn.connect(ip_address, 445)

            shares = conn.listShares()

            if shares:
                self.output_text.insert(tk.END, "SMB Shares:\n")
                for share in shares:
                    self.output_text.insert(tk.END, f"{share.name}\n")
            else:
                self.output_text.insert(tk.END, "No SMB shares found.\n")

            # Elenca gli utenti SMB
            users = conn.listUsers()

            if users:
                self.output_text.insert(tk.END, "\nSMB Users:\n")
                for user in users:
                    self.output_text.insert(tk.END, f"{user}\n")
            else:
                self.output_text.insert(tk.END, "No SMB users found.\n")

            # Chiude la connessione SMB
            conn.close()

        except Exception as e:
            # Inserisce l'eccezione nel widget di testo in caso di errore
            self.output_text.insert(tk.END, f"Error enumerating SMB: {e}\n")

    def ftp_enum(self, ip_address):
        # managing of the output texts section of tk (cleaning + new scanning text)
        self.output_text.delete("1.0", tk.END)
        self.output_text.insert(tk.END, f"FTP Enumeration on {ip_address}...\n\n")

        try:
            ftp = ftplib.FTP(ip_address)
            ftp.login()
            files = ftp.nlst()
            if files:
                self.output_text.insert(tk.END, "FTP Directory Listing: ")
                for file in files:
                    self.output_text.insert(file)
            else:
                self.output_text.insert(tk.END, "FTP Directory is empty.")
            ftp.quit()
        except Exception as e:
            self.output_text.insert(tk.END, f"Error enumerating FTP: {e}")


    def os_detection(self, ip_address):
        # Gestione della sezione di output della GUI (pulizia + nuovo testo di scansione)
        self.output_text.delete("1.0", tk.END)
        self.output_text.insert(tk.END, f"OS Detection on {ip_address}...\n\n")

        try:
            # Esegue il ping verso l'indirizzo IP per ottenere il TTL della risposta
            ping_result = subprocess.run(["ping", "-c", "1", ip_address], capture_output=True, text=True)
            ttl_index = ping_result.stdout.find("ttl=")
            if ttl_index != -1:
                ttl = int(ping_result.stdout[ttl_index + 4:].split()[0])
                # Confronta il valore TTL con database noti di valori TTL associati a sistemi operativi specifici
                if 64 <= ttl <= 128:
                    self.output_text.insert(tk.END, "OS detected: Linux or Unix-like OS\n")
                elif 128 < ttl <= 255:
                    self.output_text.insert(tk.END, "OS detected: Windows\n")
                else:
                    self.output_text.insert(tk.END, "OS detection failed: TTL value out of range\n")
            else:
                self.output_text.insert(tk.END, "OS detection failed: Unable to determine TTL\n")

        except Exception as e:
            self.output_text.insert(tk.END, f"Error detecting OS: {e}\n")


def main():
    root = tk.Tk()
    app = NetworkScanner(root)
    root.mainloop()

    #target_host = input("Insert the target IP address: ")
    #if target_host ==


if __name__ == "__main__":
    main()
