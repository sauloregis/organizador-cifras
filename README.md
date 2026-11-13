# Cifras Louvor

App de cifras para o grupo de louvor: repertório do domingo em sequência, troca de tom,
modo só letra para os vocais, rolagem automática e compartilhamento — **funciona sem internet**.

## Arquitetura

```
┌──────────────── Celular / PC (navegador) ────────────────┐
│  PWA React + TypeScript (Vite)                            │
│   ├─ Service Worker  → guarda o app para uso offline      │
│   ├─ IndexedDB (Dexie) → músicas e repertórios            │
│   └─ localStorage    → preferências (fonte, tema, modo)   │
└───────────────────────────────────────────────────────────┘
        ▲ arquivos estáticos (1ª vez / atualizações)
        │
  Hospedagem estática grátis (GitHub Pages, Netlify, Vercel, Cloudflare Pages)

Compartilhar = link com os dados comprimidos dentro dele (lz-string) ou arquivo .json
→ não existe servidor nem banco de dados.
```

**Por que não C# no backend (por enquanto):** com ~20 usuários, dados pequenos (texto) e a exigência de
funcionar offline, um servidor só adicionaria custo e um ponto de falha. Cada celular tem sua cópia.
Se no futuro vocês quiserem **sincronização ao vivo** (o líder muda a música e todos acompanham),
aí sim entra um backend ASP.NET Core + SignalR — o front já está organizado para isso.

## Rodando

```bash
npm install
npm run dev      # abre em http://localhost:5173 (e no IP da rede, para testar no celular)
npm test         # testes do motor de cifras/transposição
npm run build    # gera a pasta dist/ para publicar
```

> O modo offline e o "instalar na tela inicial" só funcionam na versão publicada (HTTPS) ou em `localhost`.

## Publicando (grátis)

Qualquer hospedagem estática serve; a pasta a publicar é `dist/`. Exemplo com Netlify:
arraste a pasta `dist` em https://app.netlify.com/drop. Com GitHub Pages, publique `dist/` via Actions.

## Formato da cifra

Igual ao Cifra Club — pode colar direto:

```
Tom: G
BPM: 72

[Intro] G  D  Em  C

[Primeira Parte]
G              D
Letra da primeira parte

[Refrão]
C        G
Letra do refrão

[Primeira Parte]
[Refrão]
```

- `[Nome]` inicia uma parte; repetir o nome sem conteúdo repete a parte.
- O nome/artista no topo (como vem do site) preenche os campos sozinhos.
- O tipo da parte (refrão, ponte, intro…) é reconhecido pelo nome e ganha uma cor.

## Estrutura

```
src/
  lib/chords.ts      reconhecimento de acordes, transposição, quebra de linha sem desalinhar
  lib/songText.ts    texto ⇄ partes da música e ordem (arranjo)
  lib/db.ts          IndexedDB, importação com controle de versão
  lib/share.ts       link comprimido, arquivo, menu de compartilhar do celular
  lib/hooks.ts       rolagem automática, tela sempre acesa, tap tempo
  components/Stage   modo apresentação (repertório inteiro em sequência)
  pages/             telas
```
