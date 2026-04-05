# Workly

Aplicación de "match" laboral desarrollada en React Native (Expo) con Firebase y UI moderna.

## Estructura del proyecto
- `/src`
  - `/constants/theme.ts` - Variables de tema, colores, sombras, y tamaños (UI moderna).
  - `/context/AuthContext.tsx` - Manejo de estado del usuario y la persistencia de autenticación.
  - `/firebase/config.ts` - Configuración centralizada de Firebase que toma variables del `.env`.
  - `/navigation/` - Contiene la lógica de las rutas con `React Navigation` (AuthStack y MainStack).
  - `/screens/` - Vistas segmentadas entre `/auth` (Login, Register) y `/main` (Home, Profile, Matches, CreateJob).
  - `/utils/storage.ts` - Funciones auxiliares genéricas como subida de archivos al Storage.
- `.env` y `.env.example` - Centralización de credenciales.
- `App.tsx` - Entrada de la app con todos los proveedores necesarios integrados.

## Instalación y Configuración

1. **Entrar al directorio**
   ```bash
   cd workly
   ```

2. **Instalar Dependencias** (Ya están instaladas, pero en caso de bajarlas):
   ```bash
   npm install
   ```

3. **Configurar Firebase**
   En la interfaz web de la consola de Firebase:
   - Habilita **Authentication** (Email/Contraseña).
   - Crea tu base de datos **Firestore Database** en Test mode.
   - Inicia **Firebase Storage**.
   - Busca tus credenciales Web (Project Settings > General > SDK setup).
   
   Copia las credenciales y reemplaza las `x` en tu archivo `.env` localmente.
   
4. **Correr el proyecto**
   ```bash
   npx expo start
   ```
