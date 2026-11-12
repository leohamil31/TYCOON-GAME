# 🎮 Tycoon Game

Jogo de blocos 10x10 (estilo Block Blast) com combos, batalha online 1v1, loja, amigos e tabuleiros animados.

## ▶️ [**JOGAR AGORA: https://leohamil31.github.io/tycoon-game-/**](https://leohamil31.github.io/tycoon-game-/)

- `src/`: app React Native + TypeScript (roda na web via react-native-web)
- `server/`: API Node/Express + PostgreSQL (amigos, loja, inventário)
- `docs/`: build publicado no GitHub Pages

## ✨ Novidades desta versão

- **Itens da loja nas partidas offline e online**: barra de power-ups abaixo do tabuleiro (⚡ x2, 💣 Bomba, 🔄 Nova Mão, ↩️ Desfazer) e botão 🛒 que abre a loja sem sair da partida. Escudo, Nova Mão, Bomba e Desfazer também aparecem como "resgate" quando você fica sem jogadas (solo e batalha).
- **Novos itens**: Nova Mão (troca as 3 peças) e Desfazer (volta a última jogada). Perfis novos do modo demonstração ganham 1 de cada + 100 moedas.
- **Batalhas rendem moedas** (mesma regra do solo: 1 moeda a cada 20 pontos).
- **Layout responsivo**: tabuleiro dimensionado pelo espaço real da tela; em paisagem/desktop a bandeja e os itens ficam ao lado do tabuleiro.
- **Efeitos**: peças entram com "pop", feixes de luz nas linhas completas, estilhaços e faíscas, tremor de tela em combos, onda de choque da bomba, "+pontos" flutuante, alerta pulsante com o tabuleiro quase cheio, confete em recorde/vitória, avisos (toasts).
- **Correções**: loop infinito de `reportRun` ao terminar a partida; toque no tabuleiro usava coordenadas do bloco tocado (peça ia para a casa errada na web); toque rápido sem movimento podia ser lido como arrasto; jogadas aceitas durante a contagem regressiva e após o fim da batalha; placar continuava mudando depois do apito final; cartões de resultado/lobby desalinhados em telas largas; `SafeAreaView` descontinuado trocado pelo de `react-native-safe-area-context`.

> O GitHub Pages é atualizado sozinho: a cada push na `main`, o workflow `.github/workflows/pages.yml` gera a versão web a partir de `preview/` e grava em `docs/`.

---

This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
