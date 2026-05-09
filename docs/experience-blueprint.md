# Queen Aurelia's Universe: Experience Blueprint

## Creative North Star

Queen Aurelia's Universe is an interactive romantic digital art experience.

It is not a traditional website, product page, dashboard, or portfolio. It should feel like entering a private emotional cosmos built for one person.

The experience should prioritize:

- Discovery over navigation
- Atmosphere over interface
- Memory over content
- Soft interaction over obvious controls
- Cinematic transitions over page changes
- Emotional pacing over speed

Every decision should answer one question:

> Does this make her feel like this world exists because of her?

## Interaction Philosophy

### Exploration, Not Navigation

There should be no traditional navbar. The universe itself is the navigation.

Primary interaction model:

- Celestial objects invite curiosity.
- Hovering reveals emotional hints.
- Clicking opens memories, letters, music, or future moments.
- Returning should feel like drifting back into space, not closing a modal.

### Soft Agency

The user should always feel guided, never instructed too heavily.

Use gentle prompts:

- "Come closer."
- "A memory is glowing here."
- "This star is still becoming."
- "Only the Queen may enter."

Avoid mechanical labels:

- "Open modal"
- "Click here"
- "Next section"
- "View details"

### Slow Reveal

Nothing should appear instantly.

Every object should:

- Fade in
- Drift into position
- Glow before revealing content
- Breathe while idle
- Leave a trace of motion

### Emotional Physics

The universe should feel alive through small reactions:

- Cursor movement creates parallax.
- Stars respond subtly to proximity.
- Important objects glow warmer as she approaches.
- The Heart Chamber can have a faint heartbeat layer.
- Future Stars remain dim, but not dead.

## Scalable Project Architecture

The app should be scene-based rather than page-based.

Recommended top-level concepts:

- `ExperienceShell`: owns global providers, audio, scene state, and Supabase session.
- `SceneDirector`: controls which major scene is active.
- `LandingScene`: black-screen awakening and first star entry.
- `UniverseScene`: explorable cosmic space.
- `ChamberScene`: sacred letter-focused emotional core.
- `OverlayLayer`: handles memory timelines, flower messages, music details, and tooltips.
- `AudioOrchestrator`: controls ambient sound, music snippets, heartbeat, and one-shot effects.
- `MotionProvider`: centralizes animation presets and reduced-motion behavior.

The important architectural rule:

> Scenes are emotional states, not routes.

React routing can exist later for private links or admin tools, but the main experience should feel continuous.

## Component Hierarchy

```text
App
  ExperienceShell
    SupabaseProvider
    MotionProvider
    AudioOrchestrator
    StardustCursor
    SceneDirector
      LandingScene
        AwakeningStarfield
        IntroTextSequence
        EntryStar
      UniverseScene
        CosmicCamera
        DeepStarfield
        CelestialObjectLayer
          MemoryConstellation
          GardenPlanet
          MusicMoon
          HeartChamberDoor
          FutureStars
        AmbientParticleLayer
      ChamberScene
        ChamberDoorTransition
        LetterSanctuary
        LetterViewer
        UnlockCountdown
    OverlayLayer
      DialogueOverlay
      MemoryTimeline
      GardenMessageCard
      MusicPlayer
      FutureStarTooltip
      SecretMessage
```

## Folder Structure

```text
src/
  app/
    App.tsx
    ExperienceShell.tsx
    SceneDirector.tsx
    providers/
      SupabaseProvider.tsx
      MotionProvider.tsx
      AudioProvider.tsx
  scenes/
    landing/
      LandingScene.tsx
      AwakeningStarfield.tsx
      IntroTextSequence.tsx
      EntryStar.tsx
    universe/
      UniverseScene.tsx
      CosmicCamera.tsx
      DeepStarfield.tsx
      CelestialObjectLayer.tsx
    chamber/
      ChamberScene.tsx
      LetterSanctuary.tsx
      ChamberDoorTransition.tsx
  features/
    memories/
      MemoryConstellation.tsx
      MemoryTimeline.tsx
      memory.types.ts
      memory.queries.ts
    garden/
      GardenPlanet.tsx
      GardenMessageCard.tsx
      garden.types.ts
      garden.queries.ts
    music/
      MusicMoon.tsx
      MusicPlayer.tsx
      music.types.ts
      music.queries.ts
    letters/
      HeartChamberDoor.tsx
      LetterViewer.tsx
      letter.types.ts
      letter.queries.ts
    future-stars/
      FutureStars.tsx
      FutureStarTooltip.tsx
      futureStar.types.ts
      futureStar.queries.ts
    easter-eggs/
      StardustCursor.tsx
      SecretPortal.tsx
      HiddenVoiceStar.tsx
  animation/
    gsap/
      timelines.ts
      landing.timeline.ts
      universe.timeline.ts
      chamber.timeline.ts
    motion/
      variants.ts
      transitions.ts
      gestures.ts
    presets/
      glow.ts
      float.ts
      reveal.ts
      parallax.ts
  audio/
    AudioOrchestrator.ts
    soundscape.config.ts
  lib/
    supabase/
      client.ts
      database.types.ts
      unlocks.ts
    time/
      unlockStatus.ts
  data/
    fallbackContent.ts
  styles/
    globals.css
    tokens.css
```

## Animation System Structure

### Ownership Rules

Use GSAP for cinematic sequences:

- Intro text timing
- Starfield awakening
- Camera zoom into the entry star
- Scene transitions
- Heart Chamber door opening
- Long-form timeline choreography

Use Framer Motion for emotional UI states:

- Hover glow
- Presence animations
- Cards and overlays
- Tooltips
- Flower message reveals
- Music player transitions
- Letter viewer transitions

Use CSS animations for ambient loops:

- Gentle floating
- Soft pulsing
- Background glow breathing
- Long-running particle drift

Use Three.js only if depth becomes central:

- 3D starfield
- Camera travel
- Orbiting celestial objects
- Spatial parallax

If Three.js is used, React should still own emotional state, while Three.js owns spatial presentation.

### Motion Tokens

Motion should be named emotionally, not mechanically.

Examples:

```ts
const motionTokens = {
  whisper: { duration: 0.6, ease: "easeOut" },
  breath: { duration: 1.8, ease: "easeInOut" },
  drift: { duration: 4.5, ease: "sine.inOut" },
  awakening: { duration: 7, ease: "power2.out" },
  heartOpen: { duration: 2.4, ease: "expo.inOut" },
};
```

### Scene Transition Model

```text
black
  -> stars awaken
  -> intro text types
  -> entry star appears
  -> user clicks
  -> camera zooms through light
  -> universe fades in from glow
  -> celestial objects drift into discoverable positions
```

Transitions should layer:

- Opacity
- Scale
- Blur
- Glow
- Spatial movement
- Audio swell

Never rely on opacity alone for important moments.

## Reusable Animation Patterns

### Breath

Used for living celestial objects.

Behavior:

- Slow scale from `1` to `1.025`
- Slight glow increase
- Returns gently

### Drift

Used for planets, flowers, stars, and overlays.

Behavior:

- Small vertical movement
- Long duration
- Randomized delay
- Infinite alternate motion

### Glow Reveal

Used before content appears.

Behavior:

- Object glow intensifies
- Background dims slightly
- Content emerges from light

### Stardust Trail

Used on cursor movement.

Behavior:

- Tiny particles spawn near cursor
- Fade and scale down
- Color shifts between gold, violet, and pale blue

### Constellation Connect

Used in Memory Constellation.

Behavior:

- Hover begins line drawing
- Stars brighten sequentially
- Lines shimmer once connected

### Sacred Door

Used for Heart Chamber.

Behavior:

- Door hums with light
- Click creates expanding glow
- Door opens slowly
- Ambient heartbeat rises
- Letter chamber appears through bloom

### Future Lock

Used for Future Stars.

Behavior:

- Dim star flickers softly
- Tooltip appears like a whisper
- Countdown or locked message fades in
- Unlock transition is a warm ignition, not a mechanical state change

## State Management Approach

Keep state intentionally simple at first.

Recommended stack:

- React state for local component interactions
- Zustand for shared experience state
- TanStack Query or lightweight custom query hooks for Supabase data
- Supabase realtime later only if live updates are useful

Suggested Zustand slices:

```text
experienceStore
  currentScene
  hasEnteredUniverse
  activeCelestialObject
  activeOverlay
  discoveredObjectIds
  visitSecretSeed
  reducedMotion

audioStore
  ambientEnabled
  currentTrackId
  volume
  heartbeatIntensity

unlockStore
  unlockedContentIds
  nextUnlockDate
```

State principle:

> Store emotional progress, not page progress.

Examples:

- Has she entered?
- What has she discovered?
- Which secret appeared this visit?
- Which letter is glowing today?

## Supabase Schema Plan

### `memories`

Stores timeline memories and constellation items.

```sql
id uuid primary key
title text not null
category text not null
body text
memory_date date
media_url text
voice_note_url text
position_x numeric
position_y numeric
position_z numeric
is_featured boolean default false
unlock_at timestamptz
created_at timestamptz default now()
```

### `garden_messages`

Stores compliments, affirmations, and flower content.

```sql
id uuid primary key
title text
message text not null
flower_type text
color text
unlock_at timestamptz
created_at timestamptz default now()
```

### `songs`

Stores songs and associated emotional context.

```sql
id uuid primary key
title text not null
artist text
audio_url text
external_url text
memory_text text
cover_url text
display_order integer
unlock_at timestamptz
created_at timestamptz default now()
```

### `letters`

Stores Heart Chamber letters.

```sql
id uuid primary key
title text not null
body text not null
letter_type text default 'love'
unlock_at timestamptz
is_pinned boolean default false
created_at timestamptz default now()
```

### `future_stars`

Stores future locked moments.

```sql
id uuid primary key
title text not null
locked_hint text
unlocked_message text
target_type text
target_id uuid
unlock_at timestamptz not null
position_x numeric
position_y numeric
position_z numeric
created_at timestamptz default now()
```

### `media_assets`

Optional shared media table.

```sql
id uuid primary key
label text
asset_type text not null
storage_path text not null
public_url text
linked_type text
linked_id uuid
created_at timestamptz default now()
```

### Unlock Rule

Content is available when:

```text
unlock_at is null OR unlock_at <= now()
```

The UI should still render locked items as dim emotional hints instead of hiding them completely.

## Implementation Phases

### Phase 1: Emotional Prototype

Goal:

Prove the feeling before building the whole system.

Build:

- React app shell
- Black-screen intro
- Starfield
- GSAP text sequence
- Entry star
- Universe transition
- A few static celestial objects
- Stardust cursor

Success criteria:

The first 60 seconds already feel magical.

### Phase 2: Explorable Universe

Build:

- Universe scene
- Celestial object layout
- Hover hints
- Click-to-open overlays
- Memory Constellation prototype
- Garden Planet prototype
- Basic ambient sound controls

Success criteria:

Exploration feels natural without menus.

### Phase 3: Emotional Content Systems

Build:

- Supabase client
- Memories table integration
- Garden messages integration
- Songs integration
- Letters integration
- Media storage support

Success criteria:

Real content can be added without changing frontend code.

### Phase 4: Heart Chamber

Build:

- Sacred door interaction
- Chamber transition
- Letter viewer
- Typed letter animation
- Heartbeat audio layer
- Scheduled letter unlocks

Success criteria:

This feels like the emotional center, not just another section.

### Phase 5: Future Stars and Easter Eggs

Build:

- Future unlock system
- Dim locked stars
- Secret interactions
- Once-per-visit portal logic
- Hidden voice note star
- Heart-shaped constellation moment

Success criteria:

Returning to the site feels rewarding.

### Phase 6: Polish and Performance

Build:

- Reduced motion mode
- Mobile interaction tuning
- Audio consent flow
- Asset compression
- Loading states
- Responsive spatial layout
- Performance profiling

Success criteria:

The universe feels smooth, intimate, and intentional on desktop and mobile.

## Personalization Questions

To make this feel like Queen Aurelia's universe instead of a generic romantic cosmos, gather:

1. What is her favorite color palette, flower, season, or natural setting?
2. Does she prefer soft emotional language, playful teasing, poetic writing, or direct heartfelt words?
3. What songs should define the Music Moon?
4. What are the first memories that must be included?
5. Do you have photos, voice notes, or screenshots to include?
6. What future dates should unlock special content?
7. Should the Heart Chamber require a passphrase, a symbolic click sequence, or no lock beyond the story?
8. Should this feel more celestial, garden-like, royal, magical, or intimate and minimal?
9. Are there private details that should never appear unless authentication is enabled?
10. Should Sir Henry appear as a named presence, a signature, or a hidden narrator?

## Coding Rule Before Implementation

Before writing production code, define:

- The first scene's exact timing
- The motion token names
- The first five celestial objects
- The audio consent behavior
- The unlock behavior for future content
- The first Heart Chamber letter format

The build should start with emotion, then architecture, then code.

