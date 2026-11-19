# Guia mobile — cidadão e administrador

## Ambiente

1. Instale Node.js 22, Git, Docker Desktop e Android Studio (Android SDK, Platform Tools, emulador, JDK adequado ao Gradle/Expo). iOS local exige macOS/Xcode.
2. Inicie o backend `docker compose up --build -d`, na raiz. Certifique-se de que `/health` retorna `status: ok`.
3. `npm install` na raiz, copie os arquivos `.env.example` de cada app para `.env.local` e ajuste o endereço da API.

| Execução | EXPO_PUBLIC_API_URL |
|---|---|
| Android Emulator | `http://10.0.2.2:3000` |
| iOS Simulator | `http://localhost:3000` |
| Dispositivo físico | `http://192.168.X.Y:3000` (IP do PC) |

Acesso no celular: abra `http://IP:3000/health` no navegador do celular. O endereço de API e a chave Google não são segredos; restrinja a chave no console. Segredos JWT/S3/SMTP ficam exclusivos no servidor. HTTP local permitido em builds Android para desenvolvimento; em produção use HTTPS e remova essa permissão.

## Execução

`npm run dev:citizen` (porta 8081) ou `npm run dev:admin` (8082). No Metro, pressione `a` para emulador Android. O Expo Go precisa ser compatível com SDK 54; para módulos nativos, mapas e push, prefira development build.

```powershell
cd apps/mobile-citizen
npx expo install --fix
npx expo run:android
npx expo start --dev-client --port 8081
```

Para admin, `cd apps/mobile-admin` e porta 8082. Após mudanças de plugins/chaves nativas, regenere e recompile (`npx expo prebuild --clean`, apenas se não houver alterações nativas manuais). O build de produção assinado usa EAS ou Gradle/Xcode com keystore/certificados próprios. Nenhum APK foi compilado nesta entrega.

## Mapas

No Google Cloud crie projeto, habilite faturamento e Maps SDK for Android (e Maps SDK for iOS quando necessário). Crie chave restrita ao pacote Android `com.urbanizago.citizen`/`com.urbanizago.admin` e SHA-1 do certificado utilizado (chaves separadas são recomendadas), ou bundle iOS. Informe `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` no `.env.local`; `app.config.js` passa ao projeto nativo. Recompile. O botão GPS usa `expo-location`; localização reversa depende do serviço do sistema. É possível ajustar coordenadas e endereço manualmente. O mapa nativo de calor depende do suporte Google do runtime.

## Push

Use dispositivo físico e EAS: dentro de cada app `npx eas-cli login`, `npx eas-cli init` para vincular um projeto, configure FCM v1/ APNs com EAS conforme a plataforma. Defina `EXPO_PUBLIC_EAS_PROJECT_ID` no `.env.local` se não estiver configurado no projeto. Faça development build e aceite a permissão. A sessão registra ExpoPushToken via `/users/me/device`, a API usa o worker. Se o projeto/token estiver ausente, notificações internas continuam disponíveis. Não coloque credencial FCM/APNs no Git.

## Código

`apps/mobile-*/App.tsx` integra React Navigation e a raiz nativa; `packages/app-ui/src/native.tsx` contém SecureStore, mapas, registro de push e exportação; `citizen.tsx` contém os fluxos do cidadão; `admin.tsx` contém todos os fluxos administrativos, também usados pelo painel web; `core.tsx` inclui autenticação, formulários e componentes reutilizáveis. Os estilos são guiados por `packages/ui-tokens`. `packages/icons/src/native.tsx` usa react-native-svg.

## Solução de problemas

- Network request failed: verifique Docker, firewall, rede, endereço e cleartext local.
- Erro de versões: `npx expo install --check` e `npx expo install --fix` dentro de cada app; revise e versione a mudança do lockfile.
- Mapa vazio: confirme chave, faturamento e restrições do aplicativo e gere novo build. Sem chave, listas e registro manual funcionam.
- Push não chega: confirme build físico, EAS project ID, permissões, credenciais e logs em API.
- Foto não carrega: atualize a tela; link expira após 15 minutos.
