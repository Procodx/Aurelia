# Queen Aurelia's Universe

## Core Idea

When she opens the link, she should not feel like she opened a webpage.

She should feel like:

> Someone built a whole world because of me.

## Design Philosophy

This is not a product.

This is emotion, discovery, memory, and wonder.

The experience should feel like:

- A dream
- A memory
- A night sky
- Intimacy
- Calm wonder
- Love made explorable

Guiding principles:

- Freestyle UI
- Soft dreamy visuals
- Storytelling through interaction
- Minimal navigation
- Exploration instead of menus
- No heavy branding
- No normal website feeling

## Experience Flow

### 1. Opening Scene: The Awakening

The screen begins completely black.

Soft ambient sound starts.

Tiny stars fade in slowly.

GSAP animation direction:

- Stars drift subtly
- Parallax depth
- Slow camera float
- Nothing appears instantly

Text types slowly:

> Some universes are born from stars...

Pause.

> Others are born from love.

Then:

> Welcome to Queen Aurelia's Universe

One glowing star appears.

Instruction fades in:

> Click the star to enter.

### 2. Entering the Universe

The camera zooms into the star, transitioning into the full space environment.

Possible implementation:

- Three.js for a richer universe
- Layered parallax divs for a softer, lighter build
- Floating particles
- Gentle glow effects

The user now sees floating celestial objects.

Each celestial object is a memory category.

There is no navbar.

She explores.

## Interactive Planets

### Memory Constellation

A cluster of small stars.

Interaction:

- Hover: stars connect into constellation lines
- Click: a timeline opens

Animations:

- Photos float in
- Messages fade in
- Voice notes can be played

Sections:

- First conversation
- First laugh
- Random moments
- Favorite pictures

Feeling:

Remembering together.

### Garden Planet

A soft emotional area filled with floating glowing flowers.

Each flower opens:

- Compliments
- Affirmations
- Things Sir Henry loves about her

Example messages:

- "The way you laugh..."
- "You make ordinary days magical."

Animation:

- Petals gently fall while reading
- Flowers breathe with soft light

### Echo Moon: Our Music

A moon orbiting slowly.

On click:

- A vinyl record spins
- Songs play
- Each song links to memory text

Animation:

- GSAP rotation
- Glow pulse synced to music
- Gentle orbit motion

### The Heart Chamber

The sacred emotional core of the universe.

A door floats in space.

Initially locked.

Text:

> Only the Queen may enter.

When clicked:

- Door opens with a light burst
- User enters the chamber

Inside:

- Letters from Sir Henry
- Typed text animation
- Future scheduled messages using Supabase unlock dates

Purpose:

This should be the place she keeps returning to.

### Future Stars

Some stars are dim.

Tooltip:

> This memory has not happened yet...

These unlock on future dates.

This creates future happiness inside the universe.

### Hidden Easter Eggs

Small secret interactions should make the world feel alive.

Ideas:

- Clicking a random star plays a voice note
- A hidden message appears after five clicks
- A constellation secretly forms a heart shape
- A secret portal appears once per visit

## Visual Style

Mood:

- Soft cosmic romance
- Warm purple
- Gold
- Deep blue
- Dreamy blur
- Glowing edges
- Floating elements

Avoid:

- Bright UI dashboards
- Heavy buttons
- Normal website layouts
- Sharp transitions
- Anything that feels corporate or productized

Everything should feel floating.

## Tech Stack

### Frontend

- React
- Framer Motion for emotional UI motion
- GSAP for cinematic sequences
- Three.js for an elite immersive universe, if the build supports it

### Backend

- Supabase

Supabase can support:

- Memories
- Letters
- Unlock dates
- Media storage
- Optional private authentication

## Architecture Idea

```text
Universe/
  LandingScene
  StarField
  CameraController
  Planets/
    MemoryPlanet
    GardenPlanet
    MusicMoon
    HeartChamber
    FutureStars
  UI/
    DialogueOverlay
    MusicPlayer
    LetterViewer
```

## Animation Principles

Everything must:

- Fade
- Float
- Breathe
- Glow
- Drift
- Feel intentional

Rule:

> Nothing should appear instantly.

Every transition should feel like the universe is revealing itself.

## Emotional Details

Details that make the universe unforgettable:

- Cursor leaves a stardust trail
- Background reacts to mouse movement
- Soft heartbeat sound near the Heart Chamber
- Loading messages such as:
  - "Aligning stars..."
  - "Preparing magic..."
  - "Summoning memories..."

## Product Feeling To Avoid

This should not feel like:

- A landing page
- A dashboard
- A portfolio
- A standard app shell
- A menu-driven website

It should feel like:

- A private universe
- A love letter with gravity
- A memory palace in the night sky
- A place made for Queen Aurelia alone

