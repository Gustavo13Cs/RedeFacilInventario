import customtkinter as ctk
from tkinter import messagebox
from PIL import Image
import os
import sys

# Função para encontrar arquivos dentro do executável
def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# Configuração Visual
ctk.set_appearance_mode("Light")
ctk.set_default_color_theme("dark-blue")

# --- CLASSE DE BOTÃO ANIMADO ---
class BotaoAnimado(ctk.CTkButton):
    def __init__(self, master, width_original, height_original, **kwargs):
        super().__init__(master, width=width_original, height=height_original, cursor="hand2", **kwargs)
        self.w_org = width_original
        self.h_org = height_original
        self.w_target = width_original + 6
        self.h_target = height_original + 4   
        self.bind("<Enter>", self.animar_crescer)
        self.bind("<Leave>", self.animar_diminuir)

    def animar_crescer(self, event):
        self.configure(width=self.w_target, height=self.h_target)
    def animar_diminuir(self, event):
        self.configure(width=self.w_org, height=self.h_org)

# --- APLICAÇÃO PRINCIPAL ---
class CalculadoraRedeFacil(ctk.CTk):
    def __init__(self):
        super().__init__()

        # --- DEFINIR ÍCONE DA JANELA (O Foguete) ---
        try:
            # Tenta carregar o ícone convertido
            self.iconbitmap(resource_path("icone_foguete.ico"))
        except Exception:
            pass # Se der erro, abre sem ícone sem travar

        # --- CORES ---
        self.cor_azul_forte = "#0047AB"
        self.cor_laranja = "#FF6600"
        self.cor_laranja_hover = "#CC5200"
        self.cor_fundo_janela = ("#F0F2F5", "#1a1a1a")    
        self.cor_fundo_card = ("#FFFFFF", "#2B2B2B")      
        self.cor_texto_principal = ("#1A1A1A", "#FFFFFF") 
        self.cor_texto_secundario = ("#606060", "#A0A0A0")
        self.cor_input_bg = ("#FAFAFA", "#343638")        
        self.cor_borda_card = ("#E0E0E0", "#333333")      
        self.cor_sucesso = ("#009E4D", "#32CD32") 
        self.cor_erro = "#D32F2F"

        self.title("Rede Fácil | Finanças Corporativas")
        self.geometry("420x680") # Aumentei um pouco a altura
        self.resizable(False, False)
        self.configure(fg_color=self.cor_fundo_janela)

        # --- CARREGAR LOGO DA INTERFACE (Laranja) ---
        self.image_logo = None
        try:
            pil_image = Image.open(resource_path("logo.png"))
            self.image_logo = ctk.CTkImage(light_image=pil_image, dark_image=pil_image, size=(100, 100))
        except Exception as e:
            print(f"Erro logo: {e}")

        self.vcmd = (self.register(self.validar_entrada), '%P')
        self._criar_interface()

    def _criar_interface(self):
        # Switch Tema
        self.frame_switch = ctk.CTkFrame(self, fg_color="transparent")
        self.frame_switch.pack(pady=(10, 0), padx=20, fill="x")
        self.switch_tema = ctk.CTkSwitch(self.frame_switch, text="Modo Escuro", command=self.alternar_tema,
            onvalue="Dark", offvalue="Light", progress_color=self.cor_azul_forte, text_color=self.cor_texto_secundario)
        self.switch_tema.pack(side="right")

        # Cabeçalho com LOGO LARANJA
        self.frame_topo = ctk.CTkFrame(self, fg_color="transparent")
        self.frame_topo.pack(pady=(10, 10))
        
        if self.image_logo:
            self.lbl_icone = ctk.CTkLabel(self.frame_topo, text="", image=self.image_logo)
            self.lbl_icone.pack(pady=(0, 5))
        else:
            self.lbl_icone = ctk.CTkLabel(self.frame_topo, text="📊", font=("Arial", 45), text_color=self.cor_laranja)
            self.lbl_icone.pack()
        
        self.lbl_titulo = ctk.CTkLabel(self.frame_topo, text="CALCULADORA REDE FÁCIL", font=("Roboto Medium", 18), text_color=self.cor_azul_forte)
        self.lbl_titulo.pack(pady=5)

        # Input
        self.card_input = ctk.CTkFrame(self, fg_color=self.cor_fundo_card, corner_radius=15, border_width=1, border_color=self.cor_borda_card)
        self.card_input.pack(pady=10, padx=20, fill="x")
        self.lbl_x = ctk.CTkLabel(self.card_input, text="Valor Variável (X):", font=("Roboto", 14, "bold"), text_color=self.cor_texto_secundario)
        self.lbl_x.pack(pady=(20, 5))
        self.entry_x = ctk.CTkEntry(self.card_input, placeholder_text=" Digite apenas números...", width=280, height=50, font=("Roboto", 20), justify="center", border_width=2, corner_radius=10, fg_color=self.cor_input_bg, text_color=self.cor_texto_principal, placeholder_text_color=self.cor_texto_secundario, border_color=self.cor_azul_forte, validate="key", validatecommand=self.vcmd)
        self.entry_x.pack(pady=(0, 25))
        self.entry_x.bind('<Return>', lambda event: self.calcular())

        # Botões
        self.frame_botoes = ctk.CTkFrame(self, fg_color="transparent")
        self.frame_botoes.pack(pady=10)
        self.btn_calcular = BotaoAnimado(self.frame_botoes, width_original=160, height_original=45, text="CALCULAR", command=self.calcular, font=("Roboto", 14, "bold"), fg_color=self.cor_laranja, text_color="white", hover_color=self.cor_laranja_hover)
        self.btn_calcular.grid(row=0, column=0, padx=15)
        self.btn_limpar = BotaoAnimado(self.frame_botoes, width_original=120, height_original=45, text="LIMPAR", command=self.limpar, font=("Roboto", 12, "bold"), fg_color=self.cor_azul_forte, text_color="white", hover_color="#003580")
        self.btn_limpar.grid(row=0, column=1, padx=15)

        # Resultados
        self.card_result = ctk.CTkFrame(self, fg_color=self.cor_fundo_card, border_width=1, border_color=self.cor_borda_card, corner_radius=15)
        self.card_result.pack(pady=15, padx=20, fill="both", expand=True)
        self.lbl_legenda_base = ctk.CTkLabel(self.card_result, text="BASE DE CÁLCULO (X * 22)", font=("Roboto", 11, "bold"), text_color=self.cor_texto_secundario)
        self.lbl_legenda_base.pack(pady=(20, 0))
        self.lbl_valor_base = ctk.CTkLabel(self.card_result, text="R$ 0,00", font=("Roboto", 18), text_color=self.cor_texto_secundario)
        self.lbl_valor_base.pack(pady=(0, 15))
        self.linha = ctk.CTkFrame(self.card_result, height=2, width=150, fg_color=self.cor_borda_card)
        self.linha.pack(pady=5)
        self.lbl_legenda_final = ctk.CTkLabel(self.card_result, text="LÍQUIDO (70%)", font=("Roboto", 12, "bold"), text_color=self.cor_azul_forte)
        self.lbl_legenda_final.pack(pady=(15, 0))
        self.lbl_resultado_final = ctk.CTkLabel(self.card_result, text="R$ 0,00", font=("Roboto", 42, "bold"), text_color=self.cor_sucesso)
        self.lbl_resultado_final.pack(pady=(0, 25))

    def alternar_tema(self):
        novo_tema = self.switch_tema.get()
        ctk.set_appearance_mode(novo_tema)
    def validar_entrada(self, texto_novo):
        if texto_novo == "": return True
        for char in texto_novo:
            if not (char.isdigit() or char in ".,"): return False
        return True
    def calcular(self):
        texto = self.entry_x.get()
        if not texto: return
        try:
            valor_limpo = texto.replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".")
            if valor_limpo == ".": return
            x = float(valor_limpo)
            base = x * 22
            final = base * 0.70
            self.lbl_valor_base.configure(text=f"R$ {base:,.2f}".replace(",", "v").replace(".", ",").replace("v", "."))
            self.lbl_resultado_final.configure(text=f"R$ {final:,.2f}".replace(",", "v").replace(".", ",").replace("v", "."), text_color=self.cor_sucesso)
            self.entry_x.configure(border_color=self.cor_azul_forte)
        except ValueError:
            self.entry_x.configure(border_color=self.cor_erro)
            self.lbl_resultado_final.configure(text="Erro", text_color=self.cor_erro)
    def limpar(self):
        self.entry_x.delete(0, 'end')
        self.entry_x.configure(border_color=self.cor_azul_forte)
        self.lbl_valor_base.configure(text="R$ 0,00")
        self.lbl_resultado_final.configure(text="R$ 0,00", text_color=self.cor_sucesso)
        self.entry_x.focus()

if __name__ == "__main__":
    app = CalculadoraRedeFacil()
    app.mainloop()