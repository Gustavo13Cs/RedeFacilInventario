from PIL import Image
import os

print("Tentando converter imagem...")

# Verifica se existe foguete.jpg ou foguete.png
arquivo_origem = ""
if os.path.exists("foguete.jpg"):
    arquivo_origem = "foguete.jpg"
elif os.path.exists("foguete.png"):
    arquivo_origem = "foguete.png"

if arquivo_origem:
    try:
        img = Image.open(arquivo_origem)
        img.save("icone_foguete.ico", format='ICO', sizes=[(256, 256)])
        print(f"✅ SUCESSO! O arquivo 'icone_foguete.ico' foi criado a partir de {arquivo_origem}.")
    except Exception as e:
        print(f"❌ Erro na conversão: {e}")
else:
    print("❌ ERRO GRAVE: Não encontrei 'foguete.jpg' nem 'foguete.png'.")
    print("Por favor, vá na pasta e RENOMEIE a imagem do foguete para 'foguete.jpg'.")