from PIL import Image

try:
    # Abre a imagem do foguete 3D
    img = Image.open("foguete_3d.png")

    # Converte e salva como ícone
    # O Windows usa vários tamanhos, 256x256 é um bom padrão para alta definição
    img.save("meu_foguete.ico", format='ICO', sizes=[(256, 256)])

    print("Sucesso! O arquivo 'meu_foguete.ico' foi criado.")
except FileNotFoundError:
    print("Erro: O arquivo 'foguete_3d.png' não foi encontrado na pasta.")
except Exception as e:
    print(f"Erro ao converter: {e}")