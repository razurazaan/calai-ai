// Muscle groups and their exercises for the Fitness tab.
// `figure` controls how the body drawing is shown: which side, which muscles are highlighted,
// and which part of the body is cropped into the card.
// `image` (optional) is a photo shown as the card background instead of the drawing.
// Its `position` and `size` (default "cover") are CSS background values for framing the photo.
import chestImg from "./assets/chest.jpg";
import backImg from "./assets/back.jpg";
import legsImg from "./assets/legs.jpg";
import glutesImg from "./assets/glutes.jpg";
import deltoidsImg from "./assets/deltoids.jpg";
import absImg from "./assets/abs.jpg";
import bicepsImg from "./assets/biceps.jpg";
import calvesImg from "./assets/calves.jpg";
import tricepsImg from "./assets/triceps.jpg";

export const REGIONS = [
  { id: "all", label: "All" },
  { id: "upper", label: "Upper body" },
  { id: "lower", label: "Lower body" },
  { id: "core", label: "Core" },
];

export const MUSCLE_GROUPS = [
  {
    id: "chest",
    name: "Chest",
    region: "upper",
    about: "Your pectorals push things away from you. Strong pecs help with pushing, lifting and posture.",
    figure: { view: "front", highlight: ["pecs"], viewBox: "28 46 144 100" },
    image: { src: chestImg, position: "center 30%" },
    exercises: [
      { name: "Push-up", equipment: "Bodyweight", level: "Beginner", sets: 3, reps: "10–15",
        steps: ["Hands a little wider than your shoulders, body in a straight line.", "Lower your chest until it's just above the floor.", "Push back up without letting your hips sag."] },
      { name: "Bench press", equipment: "Barbell", level: "Intermediate", sets: 4, reps: "6–8",
        steps: ["Lie on the bench with your eyes under the bar and feet flat.", "Lower the bar to the middle of your chest.", "Press it straight back up. Use a spotter for heavy sets."] },
      { name: "Incline dumbbell press", equipment: "Dumbbells", level: "Intermediate", sets: 3, reps: "8–10",
        steps: ["Set the bench to about 30°.", "Start with the dumbbells at chest level, palms forward.", "Press up and slightly together, then lower slowly."] },
      { name: "Dumbbell fly", equipment: "Dumbbells", level: "Beginner", sets: 3, reps: "12",
        steps: ["Lie flat holding the dumbbells above your chest with a slight bend in your elbows.", "Open your arms wide until you feel a stretch in your chest.", "Bring them back together in a hugging motion."] },
    ],
  },
  {
    id: "back",
    name: "Back",
    region: "upper",
    about: "Your lats and traps pull things towards you and keep your shoulders healthy and upright.",
    figure: { view: "back", highlight: ["traps", "lats"], viewBox: "28 50 144 140" },
    image: { src: backImg, position: "center 30%" },
    exercises: [
      { name: "Pull-up", equipment: "Pull-up bar", level: "Advanced", sets: 3, reps: "6–10",
        steps: ["Hang from the bar with hands slightly wider than your shoulders.", "Pull your chest towards the bar, leading with your elbows.", "Lower all the way down with control."] },
      { name: "Bent-over row", equipment: "Barbell", level: "Intermediate", sets: 4, reps: "8",
        steps: ["Hinge at the hips with a flat back, bar hanging below your shoulders.", "Pull the bar to your lower ribs.", "Squeeze your shoulder blades, then lower slowly."] },
      { name: "Lat pulldown", equipment: "Machine", level: "Beginner", sets: 3, reps: "10–12",
        steps: ["Sit with your thighs locked under the pads.", "Pull the bar down to your upper chest.", "Let it rise slowly until your arms are straight."] },
      { name: "Superman hold", equipment: "Bodyweight", level: "Beginner", sets: 3, reps: "30 sec",
        steps: ["Lie face down with your arms stretched out in front.", "Lift your arms, chest and legs off the floor.", "Hold, keeping your neck in line with your spine."] },
    ],
  },
  {
    id: "legs",
    name: "Legs",
    region: "lower",
    about: "Your quadriceps straighten the knee. They power walking, climbing stairs, running and jumping.",
    figure: { view: "front", highlight: ["quads"], viewBox: "50 222 100 120" },
    image: { src: legsImg, position: "center 62%" },
    exercises: [
      { name: "Squat", equipment: "Bodyweight", level: "Beginner", sets: 4, reps: "12",
        steps: ["Feet shoulder-width apart, toes slightly out.", "Sit back and down until your thighs are about parallel to the floor.", "Drive up through your whole foot."] },
      { name: "Walking lunge", equipment: "Bodyweight", level: "Beginner", sets: 3, reps: "10 each leg",
        steps: ["Step forward and lower until both knees are at about 90°.", "Keep your front knee over your ankle.", "Push off and step through with the other leg."] },
      { name: "Leg press", equipment: "Machine", level: "Beginner", sets: 3, reps: "12",
        steps: ["Place your feet shoulder-width apart on the platform.", "Lower until your knees are at about 90°.", "Press back up without locking your knees."] },
      { name: "Bulgarian split squat", equipment: "Dumbbells", level: "Intermediate", sets: 3, reps: "8 each leg",
        steps: ["Rest your back foot on a bench behind you.", "Lower straight down until your front thigh is parallel to the floor.", "Push up through your front heel."] },
    ],
  },
  {
    id: "glutes",
    name: "Gluteus",
    region: "lower",
    about: "Your glutes extend the hip. Strong glutes protect your lower back and knees.",
    figure: { view: "back", highlight: ["glutes"], viewBox: "50 214 100 70" },
    image: { src: glutesImg, position: "center 55%" },
    exercises: [
      { name: "Glute bridge", equipment: "Bodyweight", level: "Beginner", sets: 3, reps: "15",
        steps: ["Lie on your back with knees bent and feet flat.", "Push through your heels and lift your hips.", "Squeeze your glutes at the top, then lower."] },
      { name: "Hip thrust", equipment: "Barbell", level: "Intermediate", sets: 4, reps: "10",
        steps: ["Rest your upper back on a bench with the bar over your hips.", "Drive your hips up until your body is flat from shoulders to knees.", "Pause, then lower with control."] },
      { name: "Donkey kick", equipment: "Bodyweight", level: "Beginner", sets: 3, reps: "15 each leg",
        steps: ["Start on hands and knees.", "Keeping the knee bent, kick one foot up towards the ceiling.", "Lower without arching your back."] },
      { name: "Romanian deadlift", equipment: "Dumbbells", level: "Intermediate", sets: 3, reps: "10",
        steps: ["Stand holding the weights in front of your thighs.", "Push your hips back, sliding the weights down your legs.", "Stand up by squeezing your glutes."] },
    ],
  },
  {
    id: "deltoids",
    name: "Deltoids",
    region: "upper",
    about: "Your shoulder muscles lift your arms in every direction and give your upper body its width.",
    figure: { view: "front", highlight: ["delts"], viewBox: "20 44 160 90" },
    image: { src: deltoidsImg, position: "center 42%" },
    exercises: [
      { name: "Overhead press", equipment: "Dumbbells", level: "Intermediate", sets: 4, reps: "8",
        steps: ["Hold the dumbbells at shoulder height, palms forward.", "Press them straight overhead.", "Lower back to your shoulders slowly."] },
      { name: "Lateral raise", equipment: "Dumbbells", level: "Beginner", sets: 3, reps: "15",
        steps: ["Stand with light dumbbells at your sides.", "Raise your arms out to the sides up to shoulder height.", "Lower slowly. Don't swing."] },
      { name: "Front raise", equipment: "Dumbbells", level: "Beginner", sets: 3, reps: "12",
        steps: ["Hold the dumbbells in front of your thighs.", "Raise them straight in front of you to shoulder height.", "Lower with control."] },
      { name: "Pike push-up", equipment: "Bodyweight", level: "Intermediate", sets: 3, reps: "8–10",
        steps: ["Start in a push-up with your hips raised high, like an upside-down V.", "Bend your elbows to lower your head towards the floor.", "Push back up."] },
    ],
  },
  {
    id: "biceps",
    name: "Biceps",
    region: "upper",
    about: "Your biceps bend the elbow and turn your palm up. They work in every pulling movement.",
    figure: { view: "front", highlight: ["biceps"], viewBox: "26 66 148 110" },
    image: { src: bicepsImg, position: "right 40%", size: "72% auto" },
    exercises: [
      { name: "Dumbbell curl", equipment: "Dumbbells", level: "Beginner", sets: 3, reps: "12",
        steps: ["Stand with dumbbells at your sides, palms forward.", "Curl the weights up, keeping your elbows by your sides.", "Lower slowly all the way."] },
      { name: "Hammer curl", equipment: "Dumbbells", level: "Beginner", sets: 3, reps: "12",
        steps: ["Hold the dumbbells with palms facing each other.", "Curl up without turning your wrists.", "Lower with control."] },
      { name: "Chin-up", equipment: "Pull-up bar", level: "Advanced", sets: 3, reps: "6–8",
        steps: ["Hang with palms facing you, hands shoulder-width apart.", "Pull until your chin is over the bar.", "Lower all the way down."] },
    ],
  },
  {
    id: "triceps",
    name: "Triceps",
    region: "upper",
    about: "Your triceps straighten the elbow. They make up about two-thirds of your upper arm.",
    figure: { view: "back", highlight: ["triceps"], viewBox: "26 66 148 110" },
    image: { src: tricepsImg, position: "center 55%" },
    exercises: [
      { name: "Bench dip", equipment: "Bench", level: "Beginner", sets: 3, reps: "12",
        steps: ["Sit on the edge of a bench, hands beside your hips.", "Slide off and bend your elbows to lower your body.", "Push back up until your arms are straight."] },
      { name: "Overhead triceps extension", equipment: "Dumbbell", level: "Beginner", sets: 3, reps: "12",
        steps: ["Hold one dumbbell overhead with both hands.", "Lower it behind your head by bending your elbows.", "Straighten your arms to lift it back up."] },
      { name: "Close-grip push-up", equipment: "Bodyweight", level: "Intermediate", sets: 3, reps: "10",
        steps: ["Get into a push-up with your hands under your shoulders.", "Lower down, keeping your elbows close to your body.", "Push back up."] },
    ],
  },
  {
    id: "abs",
    name: "Abs",
    region: "core",
    about: "Your abdominals and obliques brace your spine, help you bend and twist, and keep you stable.",
    figure: { view: "front", highlight: ["abs", "obliques"], viewBox: "56 112 88 96" },
    image: { src: absImg, position: "center 50%" },
    exercises: [
      { name: "Plank", equipment: "Bodyweight", level: "Beginner", sets: 3, reps: "45 sec",
        steps: ["Rest on your forearms and toes.", "Keep your body in a straight line from head to heels.", "Brace your stomach and breathe steadily."] },
      { name: "Crunch", equipment: "Bodyweight", level: "Beginner", sets: 3, reps: "20",
        steps: ["Lie on your back with knees bent.", "Curl your shoulders off the floor using your abs.", "Lower slowly. Don't pull on your neck."] },
      { name: "Hanging leg raise", equipment: "Pull-up bar", level: "Advanced", sets: 3, reps: "10",
        steps: ["Hang from a bar with straight arms.", "Raise your legs until they are level with your hips.", "Lower slowly without swinging."] },
      { name: "Mountain climber", equipment: "Bodyweight", level: "Beginner", sets: 3, reps: "30 sec",
        steps: ["Start in a high plank.", "Drive one knee towards your chest, then switch quickly.", "Keep your hips low and steady."] },
    ],
  },
  {
    id: "calves",
    name: "Calves",
    region: "lower",
    about: "Your calves point your foot and push you off the ground with every step and jump.",
    figure: { view: "back", highlight: ["calves"], viewBox: "56 326 88 70" },
    image: { src: calvesImg, position: "right 40%", size: "48% auto" },
    exercises: [
      { name: "Standing calf raise", equipment: "Bodyweight", level: "Beginner", sets: 4, reps: "15",
        steps: ["Stand on the edge of a step with your heels hanging off.", "Rise up onto your toes as high as you can.", "Lower your heels below the step, then repeat."] },
      { name: "Seated calf raise", equipment: "Dumbbells", level: "Beginner", sets: 3, reps: "15",
        steps: ["Sit with a dumbbell resting on each knee.", "Lift your heels as high as you can.", "Lower slowly."] },
      { name: "Jump rope", equipment: "Skipping rope", level: "Beginner", sets: 3, reps: "60 sec",
        steps: ["Hold the handles at hip height.", "Turn the rope with your wrists and make small jumps.", "Land softly on the balls of your feet."] },
    ],
  },
];

export const findGroup = (id) => MUSCLE_GROUPS.find((g) => g.id === id);
