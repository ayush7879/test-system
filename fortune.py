import random

print("🔮 Welcome to Ayush Agrawal's Fortune Teller (21JE0204) 🔮")
mood = input("How are you feeling today? (happy/sad/neutral/stressed): ").strip().lower()

fortunes = {
    "happy": [
        "Great things await you, Ayush! Keep smiling.",
        "Your joy is contagious—spread it far and wide!",
    ],
    "sad": [
        "The clouds will part soon. Brighter days are coming.",
        "Sadness is a passing visitor—let it go.",
    ],
    "neutral": [
        "Sometimes peace is the greatest blessing.",
        "Keep steady, you're doing great.",
    ],
    "stressed": [
        "Take a deep breath—relief is on the way.",
        "Even Ayush needs rest. Prioritize yourself today.",
    ],
    "overwhelmed":[
        "Take a chill pill,Ayush.Sucess will come."
    ]
}

if mood in fortunes:
    print("✨ Your fortune:", random.choice(fortunes[mood]), "✨")
else:
    print("Please enter a valid mood.")
