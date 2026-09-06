"""Content filter for AI chat messages.

Two tiers:
- HARD terms (strong profanity, explicit sexual content, slurs, self-harm,
  hard drugs) block instantly with no context check.
- SOFT terms (mild insults, ambiguous words with innocent meanings) get an
  AI context check and are allowed when the meaning is innocent.

Handles leetspeak, masking, and repeated-character evasion.
"""

import re

_LEET_SUB = str.maketrans({
    "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
    "7": "t", "8": "b", "@": "a", "$": "s", "!": "i", "+": "t",
})

BAD_WORDS = (
    "damn", "dammit", "goddamn", "goddamnit", "goddammit", "damnation",
    "hell", "crap", "craps", "crappy", "crapola", "arse", "arses",
    "wanker", "wankers", "wank", "wanking", "wanked", "wanks",
    "sod", "sods", "bugger", "buggers", "bloody", "git", "gits", "prat",
    "prats", "berk", "plonker", "pillock", "numpty",
    "jerk", "jerks",
    "idiot", "idiots", "idiotic", "moron", "morons", "moronic", "imbecile",
    "imbeciles", "imbecilic", "dumb", "dumbs",
    "loser", "losers", "pathetic", "scumbag", "scumbags", "scum", "lowlife",
    "lowlives", "knob", "knobs", "nob", "nobs", "schmuck", "schmucks",
    "putz", "putzes", "douche", "douches",
    "balls", "booty", "booties",
    "hoe", "hoes", "hoebag", "hoebags", "thot", "thots", "thotty",
    "skank", "skanks", "skanky", "slag", "slags",
    "tramp", "tramps", "tart", "tarts", "harlot", "harlots", "strumpet",
    "bimbo", "bimbos", "golddigger", "golddiggers",
    "simp", "simps", "simping", "incel", "incels",
    "cuck", "cucks", "cuckold", "cuckolds", "perv", "pervs",
    "pervert", "perverts", "perverted", "deviant", "deviants",
    "degenerate", "degenerates", "sicko", "sickos",
    "cracker", "crackers", "redneck", "rednecks", "whitey", "whiteys",
    "honky", "honkies", "honkey", "gyp", "gypped", "paddy", "paddies",
    "nip", "nips", "slope", "slopes", "wigger", "wiggers",
    "horny", "hornier", "horniest",
    "weed", "pot", "dope", "chronic", "acid", "speed", "crystal", "crack",
    "coke", "glass", "spice", "k2", "bong", "bongs", "smack", "crank",
    "stoner", "stoners", "druggie", "druggies", "syrup", "lean", "molly",
    "oxy", "adderall", "xanax", "kratom", "salvia", "poppers", "whippets",
    "nitrous", "benzos", "dexies", "tina", "uppers", "downers",
    "overdose", "overdosing", "overdosed",
)

HARD_WORDS = (
    "fuck", "fucking", "fucker", "fucked", "fucks", "fuckin", "fck", "fuk",
    "fvck", "phuck", "motherfucker", "motherfucking", "motherfuckers",
    "fucktard", "fucktards", "fuckface", "fuckfaces", "fuckwad", "fuckwads",
    "fuckwit", "fuckwits", "fuckboy", "fuckboi", "fuckboys", "fuckbois",
    "shit", "shits", "shitty", "shitting", "bullshit", "horseshit", "sht",
    "shite", "shithead", "shitheads", "shitbag", "shitbags", "shithole",
    "shithouse",
    "bitch", "bitches", "bitchy", "bitching", "bitchass", "bitchface",
    "bastard", "bastards",
    "ass", "asses", "asshole", "assholes", "dumbass", "dumbasses", "jackass",
    "jackasses", "asswipe", "asswipes", "asshat", "asshats", "assclown",
    "assclowns", "buttmunch", "butthead", "buttheads", "buttface",
    "dick", "dicks", "dickhead", "dickheads", "dickwad", "dickwads",
    "dickface", "dickless", "dickbag", "dickbags",
    "cock", "cocks", "cocksucker", "cocksuckers", "cocksmoker", "cocksmokers",
    "cockblock", "cunt", "cunts", "pussy", "pussies", "twat", "twats",
    "twatface", "whore", "whores", "slut", "sluts", "slutty",
    "sex", "sexy", "sexual", "sexually", "sexting", "sext", "sexts",
    "sexted", "porn", "porno", "pornography", "pornographic", "pornstar",
    "pornstars", "nsfw", "nudes",
    "penis", "penises", "vagina", "vaginas", "boob", "boobs", "tits", "tit",
    "titty", "titties", "nipple", "nipples", "clit", "clits", "clitoris",
    "labia", "scrotum", "testicle", "testicles",
    "blowjob", "blowjobs", "handjob", "handjobs", "titjob", "titjobs",
    "cum", "cumming", "cumshot", "cumshots", "jizz", "spunk", "sperm",
    "masturbate", "masturbating", "masturbation", "masturbated",
    "masturbates", "fap", "fapping", "fapped", "orgasm", "orgasms",
    "orgasmic", "dildo", "dildos", "vibrator", "vibrators", "buttplug",
    "buttplugs", "buttfuck",
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
    "fingering", "fisting", "deepthroat", "deepthroating", "rawdog",
    "xxx",
    "faggot", "faggots", "fagot", "fagots", "fag", "fags", "faggotry",
    "retard", "retards", "retarded", "mongoloid", "spaz",
    "spic", "spics", "spick", "spicks", "chink", "chinks", "chinaman",
    "chinamen", "kike", "kikes", "wetback", "wetbacks",
    "tranny", "trannies", "shemale", "shemales", "ladyboy", "ladyboys",
    "dyke", "dykes", "lesbo", "lesbos", "homo", "homos",
    "poof", "poofs", "poofter", "poofters", "sodomite", "sodomites",
    "coon", "coons", "jigaboo", "jigaboos", "gook", "gooks",
    "towelhead", "towelheads", "raghead", "ragheads", "haji", "hajis",
    "hajji", "hajjis", "beaner", "beaners",
    "sandnigger", "sandniggers", "heeb", "heebs",
    "wop", "wops", "guinea", "guineas", "dago", "dagos", "mick", "micks",
    "polack", "polacks", "bohunk", "bohunks", "kraut", "krauts", "jap",
    "japs", "zipperhead", "zipperheads", "redskin", "redskins", "injun",
    "injuns", "squaw", "squaws", "halfbreed", "halfbreeds", "paki", "pakis",
    "dothead", "dotheads", "coolie", "coolies", "currymuncher",
    "currymunchers", "porchmonkey", "porchmonkeys", "junglebunny",
    "junglebunnies", "spearchucker", "spearchuckers", "pickaninny",
    "pickaninnies", "pikey", "pikeys",
    "suicide", "suicidal", "kys", "kms", "unalive", "unalived",
    "sewerslide",
    "cocaine", "heroin", "meth", "methamphetamine", "methamphetamines",
    "ecstasy", "mdma", "lsd", "fentanyl", "oxycodone", "ketamine",
    "cannabis", "shrooms", "kush", "spliff", "spliffs", "junkie", "junkies",
    "crackhead", "crackheads", "cokehead", "cokeheads", "pothead",
    "potheads", "sizzurp", "bathsalts", "flakka", "ghb", "rohypnol",
    "shabu", "yaba", "dilaudid", "oxycontin", "carfentanil", "peyote",
    "ayahuasca", "mescaline", "methadone", "percocet", "vicodin", "codeine",
)

BAD_PHRASES = (
    "kill yourself", "kill urself", "kill yorself", "kill ya self",
    "kill myself",
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
    "fuck you", "fuck off", "fuck this", "fuck that",
    "shut the fuck up",
    "jack off", "jerk off", "beat off",
    "oral sex", "anal sex", "sex tape", "sex toy", "sex toys",
    "golden shower", "date rape", "date rape drug",
    "raw dog",
    "ching chong", "camel jockey", "curry muncher", "porch monkey",
    "jungle bunny", "spear chucker", "half breed",
    "fudge packer", "butt pirate", "ass bandit",
    "carpet muncher", "muff diver", "batty boy", "he she",
    "meth head", "methhead", "pill popper", "pillpopper",
)

SOFT_PHRASES = (
    "go to hell",
    "kill me",
    "sugar daddy", "sugar baby", "sugar mommy", "sugar mama",
    "blue balls", "one night stand",
    "purple drank", "acid trip", "dime bag",
    "white trash", "trailer trash",
)

_BAD_RE = re.compile(r"\b(?:" + "|".join(re.escape(w) for w in tuple(BAD_WORDS) + tuple(HARD_WORDS)) + r")\b")
_HARD_SET = set(HARD_WORDS) | set(BAD_PHRASES)
_ALL_PHRASES = tuple(BAD_PHRASES) + tuple(SOFT_PHRASES)


def _norm(text):
    t = text.lower().translate(_LEET_SUB)
    t = re.sub(r"[^a-z ]", "", t)
    return re.sub(r"\s+", " ", t).strip()


class _Match:
    def __init__(self, term):
        self.term = term

    def group(self, i=0):
        return self.term


def _match(text):
    """First bad term (word or phrase) in text, or None. Word matches win over phrase hits."""
    if not text or not isinstance(text, str):
        return None
    n = _norm(text)
    if not n:
        return None
    c = re.sub(r"(.)\1+", r"\1", n)
    m = _BAD_RE.search(n) or _BAD_RE.search(c)
    if m:
        return m
    for p in _ALL_PHRASES:
        if p in n or p in c:
            return _Match(p)
    return None


def flag_text(text):
    """Return the first bad word/phrase found in text, or None if clean."""
    m = _match(text)
    return m.group(0) if m else None


def hard_flag_text(text):
    """Return the first hard-block term found (instant block, no context check)."""
    m = _match(text)
    if not m:
        return None
    t = m.group(0)
    return t if t in _HARD_SET else None


def is_hard_term(term):
    return term in _HARD_SET


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
        ("pass the grass", None),
        ("she is a b!tch", "bitch"),
        ("p0rn site", "porn"),
        ("slit my wrists", "slit my wrists"),
        ("kys", "kys"),
        ("crack the code", "crack"),
        ("assassin class dismissed", None),
        ("hello world", None),
        ("you are such an idiot", "idiot"),
        ("go to hell", "hell"),
    ]
    fails = 0
    for text, expect in tests:
        got = flag_text(text)
        status = "PASS" if got == expect else "FAIL"
        if got != expect:
            fails += 1
        print(f"{status}: {text!r} -> {got!r} (expected {expect!r})")
    print(f"\n{fails} failures out of {len(tests)} tests")

    hard_tests = [
        ("fuck you", True),
        ("you shit", True),
        ("i hate you retard", True),
        ("kys", True),
        ("suck my dick", True),
        ("smoke meth", True),
        ("you faggot", True),
        ("write an essay about grass", False),
        ("you are an idiot", False),
        ("go to hell", False),
        ("i like spicy food", False),
        ("hello world", False),
        ("what a moron", False),
        ("wanna smoke some weed", False),
        ("pass the grass", False),
        ("crack the code", False),
        ("you hoe", False),
    ]
    hfails = 0
    for text, expect in hard_tests:
        got = hard_flag_text(text) is not None
        status = "PASS" if got == expect else "FAIL"
        if got != expect:
            hfails += 1
        print(f"{status} hard: {text!r} -> {got} (expected {expect})")
    print(f"\n{hfails} hard failures out of {len(hard_tests)}")
