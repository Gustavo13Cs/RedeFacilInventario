from PIL import Image
import os

def converter_imagens():
    # 1. Tenta converter o Foguete para Ícone (.ico)
    arquivos_foguete = ["foguete_original.jpg", "foguete_original.png", "foguete_original.jpeg"]
    foguete_encontrado = None
    
    for arq in arquivos_foguete:
        if os.path.exists(arq):
            foguete_encontrado = arq
            break
            
    if foguete_encontrado:
        try:
            img = Image.open(foguete_encontrado)
            # Salva como .ico para o Windows
            img.save("icone_foguete.ico", format='ICO', sizes=[(256, 256)])
            print(f"✅ SUCESSO: Ícone 'icone_foguete.ico' criado a partir de {foguete_encontrado}!")
        except Exception as e:
            print(f"❌ Erro ao converter foguete: {e}")
    else:
        print("⚠️ AVISO: Não achei o arquivo 'foguete_original.jpg' (ou png). Coloque a imagem na pasta.")

    # 2. Verifica se a Logo existe
    if os.path.exists("logo.png"):
        print("✅ SUCESSO: Arquivo 'logo.png' encontrado para a interface.")
    else:
        print("⚠️ AVISO: Não achei o arquivo 'logo.png'. Renomeie sua logo laranja para este nome.")

if __name__ == "__main__":
    converter_imagens()