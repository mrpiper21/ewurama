# For Ewurama 💜 — a short film

A real-time 3D short film in the browser: she stands by a moonlit lake in a lavender meadow,
a little light (his heart) follows her through eight chapters, and at the end the fireflies
draw a heart in the sky and ask the question.

```bash
npm install
npm run dev      # open the printed URL (works on a phone on the same Wi-Fi too)
npm run build    # static site in dist/ (Netlify / Vercel / GitHub Pages)
```

Lights down, sound up, tap the wax seal. `?step=N` jumps to a scene (0–7 chapters, 8 question, 9 yes).

## Assets (downloaded)
- `public/models/Michelle.glb`, `Xbot.glb`, `Flamingo.glb`, `Stork.glb`, `Parrot.glb`, `Horse.glb`, `Flower.glb`, `waternormals.jpg`: from the three.js examples repository (Mixamo characters and animations, Mirada birds and horse)
- `public/hdri/moonrise_1k.hdr`: "Qwantani Moonrise (Pure Sky)" from Poly Haven (CC0)
- Fonts: Pinyon Script, Cormorant Garamond, Jost (Fontsource)

## Code
- `src/world/World.js`: renderer, lights, characters, animation retargeting, camera direction per scene, post-processing
- `src/world/nature.js`: sky, terrain, wind-swept grass and lavender, jacaranda tree, petals, lanterns
- `src/world/fireflies.js`: fireflies that wander, then form a heart and her name
- `src/lib/music.js`: generative music composed live in the browser
# ewurama
