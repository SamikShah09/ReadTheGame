/*
 * plays.js
 * --------
 * The clip library. Each entry is one "possession" the player watches and
 * then answers a question about.
 *
 * youtubeId: the ID from a YouTube URL you have the right to embed
 *            (e.g. youtube.com/watch?v=XXXXXXXXXXX -> "XXXXXXXXXXX").
 *            Embedding via YouTube's standard player is covered by YouTube's
 *            own terms — this does NOT pull or rehost video files directly.
 * duration:  approximate clip length in seconds. The question reveals once
 *            this much time has passed (player can also reveal early, or
 *            replay the clip — there's no pause/scrub control).
 * situation: short text describing what's happening on screen.
 * prompt:    the question asked.
 * options:   array of 2-4 answer choices.
 * correctIdx: 0-based index of the correct option.
 * explanation: shown after answering, win or lose.
 */

const SEED_PLAYS = [
  {
    id: 'seed1',
    title: 'Closeout: Catch and Shoot, or Drive?',
    youtubeId: 'qEi0Sc_xj74',
    duration: 30,
    situation: "Ball gets driven and kicked out to you on the perimeter. A defender is closing out.",
    prompt: "The closeout is under control (not flying by you). What's the read?",
    options: ['Shoot immediately off the catch', 'Drive it — closeout is tight enough to attack', 'Pump fake then reset the offense', 'Pass it right back'],
    correctIdx: 0,
    explanation: "A controlled, in-balance closeout still contests the catch-and-shoot but hasn't over-sprinted into your space. Against a slower/controlled closeout, the catch-and-shoot is the efficient read; you attack the closeout only once it's rushed or off-balance."
  },
  {
    id: 'seed2',
    title: 'Tight Closeout = Attack, Loose Closeout = Shoot',
    youtubeId: 'DodveomyemI',
    duration: 30,
    situation: "Same catch-on-the-perimeter situation, but the defender flies at you off-balance, too close to contest a drive.",
    prompt: "The defender closes out too hard and is off-balance. What's the read?",
    options: ['Shoot over the top anyway', 'Drive past them — a tight, off-balance closeout opens a driving lane', 'Swing the ball to the weak side', 'Call a timeout'],
    correctIdx: 1,
    explanation: "Tight/rushed closeout → attack it off the dribble, since the defender gave up the drive to contest the shot. Loose/under-control closeout → take the open shot instead."
  },
  {
    id: 'seed3',
    title: 'Attacking Closeout Defenders',
    youtubeId: 'UJPIJSe8e-Q',
    duration: 30,
    situation: "You catch the ball on the wing as your defender scrambles to closeout from a rotation.",
    prompt: 'Your defender is scrambling to close out from help position. What should you do first?',
    options: ['Square up and shoot immediately no matter what', 'Read the closeout speed/balance before deciding to shoot or drive', 'Always drive, no exceptions', 'Pass to whoever is closest'],
    correctIdx: 1,
    explanation: "The skill here is reading the closeout itself — speed, angle, balance — before committing to shoot or drive, instead of defaulting to one option every time."
  },
  {
    id: 'seed4',
    title: 'Shoot or Drive? (The Common Mistake)',
    youtubeId: 'mzLo84Rpsuo',
    duration: 25,
    situation: "A shooter catches the ball with a defender closing out from one pass away.",
    prompt: 'What mistake do most players make in this exact spot?',
    options: ["They shoot too early before checking the closeout", "They drive even when the closeout is under control and a hand is down", "They pass up an open shot to force a drive into help", "They travel"],
    correctIdx: 2,
    explanation: "The common mistake: over-driving into a set defense/help when the closeout was actually loose enough to just shoot — turning a good shot into a tough, contested drive."
  },
  {
    id: 'seed5',
    title: 'Cutting Backdoor vs. an Overplaying Defender',
    youtubeId: 'xQxLSFoszEM',
    duration: 25,
    situation: "You're on the wing and your defender is overplaying the passing lane, denying the catch.",
    prompt: "Your defender denies the pass by overplaying the lane. What's the read?",
    options: ['Cut backdoor toward the basket for the lob/bounce pass', 'Stand still and wait for the defender to back off', 'Wave for the ball anyway', 'Run to the opposite corner'],
    correctIdx: 0,
    explanation: "A defender who overplays/denies the passing lane has taken away the catch on that side, but leaves the basket side open — the backdoor cut punishes exactly that positioning."
  },
  {
    id: 'seed6',
    title: 'What Is a Backdoor Cut?',
    youtubeId: 'tmrtpJL9KpE',
    duration: 25,
    situation: "Conceptual breakdown of the backdoor cut as a counter to denial defense.",
    prompt: 'A backdoor cut is specifically the counter to which defensive action?',
    options: ['A double team on the ball', 'A defender denying/overplaying the passing lane', 'A zone defense', 'A full-court press'],
    correctIdx: 1,
    explanation: "The backdoor cut exists to punish a defender who plays too far up in the passing lane trying to deny the catch — the cutter goes behind them to the rim instead of fighting for the catch out front."
  },
  {
    id: 'seed7',
    title: 'Defense Shooting the Gap',
    youtubeId: 'yP4aVR5RbxE',
    duration: 30,
    situation: "Coming off a pindown screen, your defender cheats and 'shoots the gap' — jumping the passing lane early instead of trailing over the top.",
    prompt: "Your defender shoots the gap on a pindown and the corner is open. What's the read?",
    options: ['Force the catch anyway through the defender', 'Skip/reverse the ball to the open corner', 'Cut to the block', 'Reset to half court'],
    correctIdx: 1,
    explanation: "When a defender jumps the gap to deny one side, they leave the opposite side (often the corner) open — the read is to get the ball there rather than force a pass into the denial."
  },
  {
    id: 'seed8',
    title: 'Help Defense Rotation: "Sink"',
    youtubeId: 'GCLHVFGLVrg',
    duration: 30,
    situation: "On defense: the ball gets driven into the paint and your teammate needs low help. This clip shows the 'sink' rotation concept.",
    prompt: "As the help-side defender when the ball is driven baseline, what does a proper 'sink' rotation require?",
    options: ["Stay locked on your own man no matter what", "Sink down to help at the rim, then recover out to your man if the ball kicks out", "Leave the court entirely", "Double the ball on the perimeter"],
    correctIdx: 1,
    explanation: "'Sink' rotations mean help-side defenders drop toward the paint to protect the rim against the drive, then scramble back out to shooters if the ball is kicked — a stopgap, not a permanent switch."
  }
];
