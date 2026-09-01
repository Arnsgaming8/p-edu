"""Content filter for AI chat messages.

Detects profanity, sexual content, slurs, self-harm phrases, and drugs.
Handles leetspeak, masking, and repeated-character evasion.
"""

import re

_LEET_SUB = str.maketrans({
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
    "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "+": "t",
})

BAD_WORDS = (
    
    "fuck", "fucking", "fucker", "fucked", "fucks", "fuckin", "fck", "fuk",
    "fvck", "phuck", "motherfucker", "motherfucking", "motherfuckers",
    "fucktard", "fucktards", "fuckface", "fuckfaces", "fuckwad", "fuckwads",
    "fuckwit", "fuckwits", "fuckboy", "fuckboi", "fuckboys", "fuckbois",
    "shit", "shits", "shitty", "shitting", "bullshit", "horseshit", "sht",
    "shite",    "shithead", "shitheads", "shitbag", "shitbags", "shithole",
    "shithouse",
    "bitch", "bitches", "bitchy", "bitching", "bitchass", "bitchface",
    "bastard", "bastards",
    "ass", "asses", "asshole", "assholes", "dumbass", "dumbasses", "jackass",
    "jackasses", "asswipe", "asswipes", "asshat", "asshats", "assclown",
    "assclowns", "buttmunch", "butthead", "buttheads", "buttface",
    "dick", "dicks", "dickhead", "dickheads", "dickwad", "dickwads",
    "dickface", "dickless", "dickbag", "dickbags",
    "cock", "cocks",    "cocksucker", "cocksuckers", "cocksmoker", "cocksmokers",
    "cockblock", "cunt", "cunts", "pussy", "pussies", "twat", "twats",
    "twatface", "whore", "whores", "slut", "sluts", "slutty", "horny",
    "hornier", "horniest",
    "goddamn", "goddamnit", "goddammit", "damn", "dammit", "damnation",
    "hell", "crap", "craps", "crappy", "crapola", "arse", "arses",
    "arsehole", "arseholes", "wanker", "wankers", "tosser", "tossers",
    "sod", "sods", "bugger", "buggers", "bloody", "git", "gits", "prat",
    "prats", "berk", "plonker", "pillock", "numpty",
    "jerk", "jerks", "jerkoff", "jerkoffs", "jackoff", "jackoffs",
    "idiot", "idiots", "idiotic", "moron", "morons", "moronic", "imbecile",
    "imbeciles", "imbecilic", "dumb", "dumbs", "dumbfuck", "dumbfucks",
    "loser", "losers", "pathetic", "scumbag", "scumbags", "scum", "lowlife",
    "lowlives", "knob", "knobs", "knobhead", "knobheads", "nob", "nobs",
    "nobhead", "nobheads", "prick", "pricks", "prickface", "schmuck",
    "schmucks", "putz", "putzes", "douche", "douches", "douchebag",
    "douchebags",
    
    "sex", "sexy", "sexual", "sexually", "sexting", "sext", "sexts",
    "sexted", "porn", "porno", "pornography", "pornographic", "pornstar",
    "pornstars", "nsfw", "nudes",
    "penis", "penises", "vagina", "vaginas", "boob", "boobs", "tits", "tit",
    "titty", "titties", "nipple", "nipples", "clit", "clits", "clitoris",
    "labia", "scrotum", "testicle", "testicles", "balls",
    "blowjob", "blowjobs", "handjob", "handjobs", "titjob", "titjobs",
    "cum", "cumming", "cumshot", "cumshots", "jizz", "spunk",
    "sperm", "masturbate", "masturbating", "masturbation", "masturbated",
    "masturbates", "wank", "wanking", "wanked", "wanks", "fap", "fapping",
    "fapped", "orgasm", "orgasms", "orgasmic", "dildo", "dildos",
    "vibrator", "vibrators", "buttplug", "buttplugs", "buttfuck",
    "rape", "raped", "rapes", "raping", "rapist", "rapists",
    "molested", "molest", "molesting", "molester", "molesters",
    "molestation", "pedophile", "pedophiles", "pedo", "pedos", "paedophile",
    "paedophiles", "paedo", "paedos", "nonce", "nonces", "groomer",
    "groomers", "incest", "incestuous", "naked", "nude", "nudity",
    "erotic", "erotica", "gangbang", "gangbangs", "threesome",
    "threesomes", "foursome", "foursomes", "orgy", "orgies", "hooker",
    "hookers", "prostitute", "prostitutes", "prostitution", "brothel",
    "brothels", "whorehouse", "whorehouses", "bdsm", "fetish", "fetishes",
    "fetishist", "stripper", "strippers", "striptease", "milf", "gilf",
    "dilf", "anal", "ejaculate", "ejaculating", "ejaculation",
    "ejaculated", "boner", "boners", "hardon", "hardons", "erection",
    "erections", "intercourse", "coitus", "copulate", "copulating",
    "copulation", "fornicate", "fornicating", "fornication", "semen",
    "rimjob", "rimjobs", "bukkake", "creampie", "creampies", "squirt",
    "squirted", "squirting", "onlyfans", "hentai", "yiff", "swinger",
    "swingers", "bondage", "sadism", "sadist", "sadists", "sadistic",
    "masochism", "masochist", "masochists", "kink", "kinks", "kinky",
    "kinkier", "voyeur", "voyeurs", "voyeurism", "exhibitionist",
    "exhibitionists", "exhibitionism", "lapdance", "lapdances",
    "dominatrix", "gigolo", "gigolos", "pimp", "pimps", "pimping",
    "fingering", "fisting",    "deepthroat", "deepthroating", "rawdog",
    "booty", "booties", "xxx",
    
    "hoe", "hoes", "hoebag", "hoebags", "thot", "thots", "thotty",
    "skank", "skanks", "skanky", "tramp", "tramps", "slag", "slags",
    "tart", "tarts", "harlot", "harlots", "strumpet", "bimbo", "bimbos",
    "golddigger", "golddiggers", "simp", "simps", "simping", "incel",
    "incels", "cuck", "cucks", "cuckold", "cuckolds", "perv", "pervs",
    "pervert", "perverts", "perverted", "deviant", "deviants",
    "degenerate", "degenerates", "sicko", "sickos", "roofie", "roofies",
    
    "nigger", "niggers", "nigga", "niggas", "niggaz",
    "faggot", "faggots", "fagot", "fagots", "fag", "fags", "faggotry",
    "retard", "retards", "retarded", "mongoloid", "spaz",
    "spic", "spics", "spick", "spicks", "chink", "chinks", "chinaman",
    "chinamen", "kike", "kikes", "wetback", "wetbacks",
    "tranny", "trannies", "shemale", "shemales", "ladyboy", "ladyboys",
    "dyke", "dykes", "lesbo", "lesbos", "homo", "homos", "gaylord",
    "gaylords", "poof", "poofs", "poofter", "poofters", "sodomite",
    "sodomites",
    "coon", "coons", "jigaboo", "jigaboos", "gook", "gooks",
    "towelhead", "towelheads", "raghead", "ragheads", "haji", "hajis",
    "hajji", "hajjis", "beaner", "beaners", "honky", "honkies", "honkey",
    "honkeys", "sandnigger", "sandniggers", "heeb", "heebs",
    "wop", "wops", "guinea", "guineas", "dago", "dagos", "mick", "micks",
    "paddy", "paddies", "polack", "polacks", "bohunk", "bohunks",
    "kraut", "krauts", "jap", "japs", "nip", "nips", "slope", "slopes",
    "zipperhead", "zipperheads", "redskin", "redskins", "injun", "injuns",
    "squaw", "squaws", "halfbreed", "halfbreeds", "paki", "pakis",
    "dothead", "dotheads", "coolie", "coolies", "currymuncher",
    "currymunchers", "porchmonkey", "porchmonkeys", "junglebunny",
    "junglebunnies", "spearchucker", "spearchuckers", "pickaninny",
    "pickaninnies", "wigger", "wiggers", "whitey", "whiteys", "cracker",
    "crackers", "peckerwood", "peckerwoods", "whitetrash", "redneck",
    "rednecks", "gypsy", "gypsies", "gyp", "gypped", "pikey", "pikeys",
    
    "suicide", "suicidal", "kys", "kms", "unalive", "unalived",
    "sewerslide", "overdose", "overdosing", "overdosed",
    
    "cocaine", "heroin", "meth", "methamphetamine", "methamphetamines",
    "ecstasy", "mdma", "lsd", "fentanyl", "oxycodone", "ketamine",
    "weed", "marijuana", "cannabis", "pot", "grass", "chronic", "dope",
    "coke", "crack", "acid", "speed", "crystal", "shrooms", "kush",
    "spliff", "spliffs", "bong", "bongs", "smack", "junkie", "junkies",
    "crackhead", "crackheads", "cokehead", "cokeheads", "pothead",
    "potheads", "stoner", "stoners", "druggie", "druggies", "xanax",
    "adderall", "percocet", "oxy", "vicodin", "codeine", "lean", "molly",
    "sizzurp", "syrup", "bathsalts", "flakka", "ghb", "rohypnol",
    "shabu", "yaba", "dilaudid", "oxycontin", "carfentanil", "nitrous",
    "whippets", "poppers", "salvia", "dmt", "ayahuasca", "peyote",
    "mescaline",    "kratom", "methadone", "crank", "uppers", "downers",
    "benzos", "dexies", "spice", "k2", "tina", "glass",
)

BAD_PHRASES = (
    "kill yourself", "kill urself", "kill yorself", "kill ya self",
    "kill myself", "kill me",
    "self harm", "selfharm", "crystalmeth", "cut yourself", "cut urself",
    "cut myself", "cut my wrists", "slit wrists", "slit my wrists",
    "slit your wrists", "end yourself", "end it all", "end my life",
    "end my own life", "neck yourself", "hang yourself", "hanging yourself",
    "hang myself", "drown yourself", "jump off a bridge", "jump off bridge",
    "better off dead", "want to die", "wanna die", "dont want to live",
    "don't want to live", "no reason to live", "no point living",
    "self mutilation", "selfmutilation", "mutilate yourself",
    "crystal meth",
    "son of a bitch", "son of a whore",
    "go to hell", "fuck you", "fuck off", "fuck this", "fuck that",
    "shut the fuck up",
    "jack off", "jerk off", "beat off",
    "oral sex", "anal sex", "sex tape", "sex toy", "sex toys",
    "sugar daddy", "sugar baby", "sugar mommy", "sugar mama",
    "golden shower", "date rape", "date rape drug", "blue balls",
    "raw dog", "one night stand",
    "ching chong", "camel jockey", "curry muncher", "porch monkey",
    "jungle bunny", "spear chucker", "half breed", "white trash",
    "trailer trash", "fudge packer", "butt pirate", "ass bandit",
    "carpet muncher", "muff diver", "batty boy", "he she",
    "purple drank", "bath salts", "acid trip", "dime bag",
    "crystal meth", "meth head", "methhead", "pill popper", "pillpopper",
)

_BAD_RE = re.compile(r"\b(?:" + "|".join(re.escape(w) for w in BAD_WORDS) + r")\b")


def _norm(text):
    t = text.lower().translate(_LEET_SUB)
    t = re.sub(r"[^a-z ]", "", t)
    return re.sub(r"\s+", " ", t).strip()


def flag_text(text):
    """Return the first bad word/phrase found in text, or None if clean."""
    if not text or not isinstance(text, str):
        return None
    n = _norm(text)
    if not n:
        return None
    c = re.sub(r"(.)\1+", r"\1", n)  
    m = _BAD_RE.search(n) or _BAD_RE.search(c)
    if m:
        return m.group(0)
    for p in BAD_PHRASES:
        if p in n or p in c:
            return p
    return None


if __name__ == "__main__":
    
    tests = [
        ("fuck you", "fuck"),
        ("s3x", "sex"),
        ("kill yourself", "kill yourself"),
        ("hey how are you", None),
        ("class dismissed", None),
        ("f*ck that", "fck"),
        ("fuuuuuck", "fuck"),
        ("you hoe", "hoe"),
        ("that simp is such a cuck", "simp"),
        ("wanna smoke some weed", "weed"),
        ("pass the grass", "grass"),
        ("she is a b!tch", "bitch"),
        ("p0rn site", "porn"),
        ("slit my wrists", "slit my wrists"),
        ("kys", "kys"),
        ("crack the code", "crack"),
        ("assassin class dismissed", None),
        ("hello world", None),
    ]
    fails = 0
    for text, expect in tests:
        got = flag_text(text)
        status = "PASS" if got == expect else "FAIL"
        if got != expect:
            fails += 1
        print(f"{status}: {text!r} -> {got!r} (expected {expect!r})")
    print(f"\n{fails} failures out of {len(tests)} tests")
