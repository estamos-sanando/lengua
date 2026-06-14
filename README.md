# 🤟 SignSpeak Mobile Web App

Una aplicación web responsive, interactiva y ultra-premium para la traducción en tiempo real del alfabeto manual de la Lengua de Señas Española a texto y voz sintética.

Este repositorio aloja la versión web estática optimizada para dispositivos móviles, la cual realiza la detección e inferencia de Inteligencia Artificial de forma **100% local en el navegador del cliente** (sin enviar datos a servidores externos, garantizando privacidad total y latencia mínima).

## 🚀 Características

* **Inferencia Local con ONNX:** Carga y ejecuta el modelo de red neuronal entrenado (`modelo_abecedario.onnx`) directamente en el navegador web usando **ONNX Runtime Web**.
* **Detección de Landmarks:** Utiliza **MediaPipe Hands JS** para capturar y estructurar en tiempo real las coordenadas tridimensionales de 21 puntos clave de la mano.
* **Diseño Glassmorphic Premium:** Interfaz oscura adaptada a móviles (mobile-first portrait) con gradientes de neón reactivos a la confianza de la predicción y layout ergonómico para uso táctil.
* **Autocorrección Integrada:** Algoritmo de distancia de Levenshtein en JS que detecta y sugiere correcciones para palabras del diccionario en tiempo real (ej. si deletreas `HOL`, sugiere autocorregir a `HOLA`).
* **Síntesis de Voz (TTS):** Utiliza la API nativa `SpeechSynthesis` del navegador del dispositivo para reproducir palabras y frases formadas de forma hablada en español.
* **Guía Interactiva:** Modal integrado con la descripción de señas del alfabeto. Al tocar una letra, el teléfono pronuncia auditivamente cómo realizarla.

## 🛠️ Tecnologías

* **MediaPipe Hands** (Detección de puntos clave)
* **ONNX Runtime Web** (Ejecución del modelo de IA en el navegador)
* **Web Speech API** (Síntesis de voz)
* **HTML5, Vanilla CSS (Glassmorphism & Grid) y JavaScript ES6**

## 💻 Configuración para Móviles (Despliegue Local)

Los navegadores móviles bloquean el acceso a la cámara mediante conexiones HTTP estándar por seguridad. Para usar la app localmente en tu red local WiFi por HTTP:

### En Android (Google Chrome):
1. Abre en Chrome de tu teléfono: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Configura a **Enabled**.
3. En la caja de texto, escribe la dirección IP de tu servidor (ej. `http://192.168.1.15:8000`).
4. Presiona **Relaunch** para reiniciar Chrome.

## 🌍 Despliegue en la Web (Vercel)

Al desplegarse en una plataforma como **Vercel** o **GitHub Pages**, el sitio web cuenta con un certificado SSL (HTTPS) por defecto, por lo que **la cámara y la aplicación web funcionarán de forma instantánea en cualquier celular o PC (Android / iOS) sin realizar ninguna configuración extra**.
