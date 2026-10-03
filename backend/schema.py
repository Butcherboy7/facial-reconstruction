"""Facial feature schema: single source of truth.

Each question has options with:
  id      stored in the structured facial profile
  label   shown to the witness
  phrase  natural-language fragment used by the prompt builder
  p       numeric drawing params used by the frontend sketch renderer
"""

def O(id, label, phrase=None, **p):
    return {"id": id, "label": label, "phrase": phrase if phrase is not None else label.lower(), "p": p}

STEPS = [
    {"id": "basics", "title": "Basics", "questions": [
        {"key": "sex", "q": "What was the person's apparent sex?", "kind": "chips", "options": [
            O("male", "Male", "man"), O("female", "Female", "woman")]},
        {"key": "age", "q": "Approximately how old did the person appear?", "kind": "age"},
        {"key": "skin", "q": "What was the skin complexion?", "kind": "swatch", "options": [
            O("very_light", "Very light", "very fair skin", c="#f3d9c6"), O("light", "Light", "light skin", c="#e8bf9f"),
            O("medium", "Medium", "medium skin", c="#cf9d73"), O("olive", "Olive", "olive skin", c="#b98655"),
            O("brown", "Brown", "brown skin", c="#8d5a37"), O("dark", "Dark", "dark skin", c="#5a3724")]},
    ]},
    {"id": "face", "title": "Face Shape", "questions": [
        {"key": "face_shape", "q": "What was the overall shape of the person's face?", "kind": "sketch", "options": [
            O("oval", "Oval", "an oval face", top=.80, mid=.88, jaw=.60, len=1.0, chin=.5),
            O("round", "Round", "a round face", top=.84, mid=.95, jaw=.78, len=.88, chin=.2),
            O("square", "Square", "a square face", top=.86, mid=.90, jaw=.86, len=.94, chin=0),
            O("heart", "Heart", "a heart-shaped face", top=.92, mid=.86, jaw=.44, len=1.0, chin=.8),
            O("long", "Long", "a long narrow face", top=.76, mid=.80, jaw=.62, len=1.14, chin=.4),
            O("diamond", "Diamond", "a diamond-shaped face with prominent cheekbones", top=.70, mid=.96, jaw=.50, len=1.02, chin=.7),
        ]},
        {"key": "forehead", "q": "How was the forehead?", "kind": "chips", "options": [
            O("low", "Low", "a low forehead", h=.8), O("medium", "Medium", "a medium forehead", h=1.0),
            O("high", "High", "a high forehead", h=1.2)]},
        {"key": "cheeks", "q": "How were the cheeks and cheekbones?", "kind": "chips", "options": [
            O("average", "Average", "average cheeks"), O("full", "Full cheeks", "full cheeks"),
            O("hollow", "Hollow", "hollow cheeks"), O("high_cheekbones", "High cheekbones", "high prominent cheekbones")]},
    ]},
    {"id": "hair", "title": "Hair", "questions": [
        {"key": "hair_style", "q": "Which hairstyle most closely resembles what you remember?", "kind": "sketch", "options": [
            O("bald", "Bald", "a shaved bald head"), O("buzz", "Buzz cut", "a buzz cut"),
            O("short", "Short", "short hair"), O("receding", "Receding", "short, slightly receding hair"),
            O("swept", "Medium swept", "medium-length swept hair"), O("curly", "Curly", "short curly hair"),
            O("long", "Long", "long hair"), O("bun", "Tied back", "hair tied back"),
        ]},
        {"key": "hair_color", "q": "What colour was the hair?", "kind": "swatch", "options": [
            O("black", "Black", "black", c="#1b1b1d"), O("dark_brown", "Dark brown", "dark brown", c="#3b2a20"),
            O("brown", "Brown", "brown", c="#6b4a32"), O("blond", "Blond", "blond", c="#c9a463"),
            O("red", "Red", "red", c="#98421f"), O("grey", "Grey", "grey", c="#9a9a9c")]},
    ]},
    {"id": "brows_eyes", "title": "Eyebrows & Eyes", "questions": [
        {"key": "eyebrows", "q": "What were the eyebrows like?", "kind": "sketch", "options": [
            O("thin_arched", "Thin arched", "thin arched eyebrows", t=1.6, a=6),
            O("medium", "Medium straight", "medium straight eyebrows", t=3, a=1),
            O("thick_straight", "Thick straight", "thick straight eyebrows", t=5.5, a=0),
            O("thick_arched", "Thick arched", "thick arched eyebrows", t=5.5, a=5),
            O("bushy", "Bushy", "bushy heavy eyebrows", t=8, a=2)]},
        {"key": "eyes", "q": "What was the eye shape?", "kind": "sketch", "options": [
            O("almond", "Almond", "almond-shaped eyes", w=1, h=1, tilt=0, lid=0),
            O("round", "Round", "round eyes", w=.9, h=1.5, tilt=0, lid=0),
            O("narrow", "Narrow", "narrow eyes", w=1.05, h=.55, tilt=0, lid=0),
            O("hooded", "Hooded", "hooded eyes", w=1, h=.8, tilt=0, lid=1),
            O("deep_set", "Deep-set", "deep-set eyes", w=1, h=.85, tilt=0, lid=.6),
            O("upturned", "Upturned", "upturned eyes", w=1, h=.9, tilt=3, lid=0)]},
        {"key": "eye_color", "q": "What colour were the eyes?", "kind": "swatch", "options": [
            O("brown", "Brown", "brown eyes", c="#4a2c18"), O("hazel", "Hazel", "hazel eyes", c="#7a5a2a"),
            O("green", "Green", "green eyes", c="#4d7a4f"), O("blue", "Blue", "blue eyes", c="#4478a8"),
            O("grey", "Grey", "grey eyes", c="#78858f")]},
        {"key": "eye_spacing", "q": "How far apart were the eyes?", "kind": "chips", "options": [
            O("close", "Close-set", "closely spaced eyes", s=.85), O("average", "Average", "average eye spacing", s=1),
            O("wide", "Wide-set", "wide-set eyes", s=1.18)]},
    ]},
    {"id": "nose", "title": "Nose", "questions": [
        {"key": "nose", "q": "What was the nose shape?", "kind": "sketch", "options": [
            O("straight", "Straight", "a straight nose", w=1, l=1, hook=0, up=0),
            O("broad", "Broad", "a broad wide nose", w=1.45, l=.95, hook=0, up=0),
            O("narrow", "Narrow", "a narrow nose", w=.72, l=1.05, hook=0, up=0),
            O("hooked", "Hooked", "a hooked aquiline nose", w=.95, l=1.1, hook=1, up=0),
            O("upturned", "Upturned", "an upturned nose", w=.9, l=.8, hook=0, up=1),
            O("long", "Long", "a long nose", w=1, l=1.3, hook=0, up=0)]},
        {"key": "nose_size", "q": "How large was the nose relative to the face?", "kind": "chips", "options": [
            O("small", "Small", "a small nose"), O("medium", "Medium", "a medium-sized nose"), O("large", "Large", "a large nose")]},
    ]},
    {"id": "mouth", "title": "Mouth & Jaw", "questions": [
        {"key": "mouth", "q": "What was the mouth/lip shape?", "kind": "sketch", "options": [
            O("thin", "Thin lips", "thin lips", w=1, up=.5, lo=.7), O("medium", "Medium", "medium lips", w=1, up=1, lo=1.3),
            O("full", "Full lips", "full lips", w=1.05, up=1.7, lo=2.2), O("wide", "Wide mouth", "a wide mouth", w=1.35, up=1, lo=1.4),
            O("small", "Small mouth", "a small mouth", w=.7, up=1, lo=1.2)]},
        {"key": "jaw", "q": "What was the jaw like?", "kind": "chips", "options": [
            O("soft", "Soft", "a soft jawline"), O("strong", "Strong", "a strong defined jaw"),
            O("angular", "Angular", "an angular jaw"), O("narrow", "Narrow", "a narrow jaw")]},
        {"key": "chin", "q": "What was the chin like?", "kind": "chips", "options": [
            O("receding", "Receding", "a receding chin"), O("medium", "Medium", "a medium chin"),
            O("projecting", "Projecting", "a projecting chin"), O("cleft", "Cleft", "a cleft chin"),
            O("pointed", "Pointed", "a pointed chin")]},
        {"key": "ears", "q": "What were the ears like?", "kind": "chips", "options": [
            O("small", "Small", "small ears", s=.8), O("medium", "Medium", "medium ears", s=1),
            O("large", "Large", "large ears", s=1.25), O("protruding", "Protruding", "protruding ears", s=1.2)]},
    ]},
    {"id": "facial_hair", "title": "Facial Hair", "questions": [
        {"key": "beard", "q": "Did the person have facial hair?", "kind": "sketch", "options": [
            O("none", "Clean-shaven", "clean-shaven"), O("stubble", "Stubble", "light stubble"),
            O("short", "Short beard", "a short trimmed beard"), O("full", "Full beard", "a full beard"),
            O("goatee", "Goatee", "a goatee")]},
        {"key": "mustache", "q": "Was there a mustache?", "kind": "chips", "options": [
            O("none", "None", "no mustache"), O("thin", "Thin", "a thin mustache"),
            O("thick", "Thick", "a thick mustache"), O("handlebar", "Handlebar", "a handlebar mustache")]},
        {"key": "sideburns", "q": "Were there sideburns?", "kind": "chips", "options": [
            O("none", "None", "no sideburns"), O("short", "Short", "short sideburns"), O("long", "Long", "long sideburns")]},
    ]},
    {"id": "skin", "title": "Marks & Glasses", "questions": [
        {"key": "marks", "q": "Any distinctive marks? (select all that apply)", "kind": "multi", "options": [
            O("scar_left_cheek", "Scar, left cheek", "a small scar on the left cheek"),
            O("scar_right_cheek", "Scar, right cheek", "a small scar on the right cheek"),
            O("scar_eyebrow", "Scar through eyebrow", "a scar through the right eyebrow"),
            O("mole_cheek", "Mole on cheek", "a mole on the cheek"),
            O("birthmark_forehead", "Birthmark", "a birthmark on the forehead"),
            O("freckles", "Freckles", "freckles across the nose and cheeks"),
            O("wrinkles", "Pronounced wrinkles", "pronounced wrinkles and lines")]},
        {"key": "glasses", "q": "Was the person wearing glasses?", "kind": "chips", "options": [
            O("none", "No", "no glasses"), O("glasses", "Yes", "wearing glasses")]},
    ]},
]

QUESTIONS = {q["key"]: q for s in STEPS for q in s["questions"]}
REQUIRED = ["sex", "skin", "face_shape", "hair_style", "eyebrows", "eyes", "nose", "mouth", "jaw", "beard"]


def phrase(key, value):
    q = QUESTIONS[key]
    for o in q.get("options", []):
        if o["id"] == value:
            return o["phrase"]
    return None
