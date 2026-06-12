"""Arabic display names for seeded tournament data."""

WC2026_TOURNAMENT_AR = "كأس العالم 2026"
DEMO_TEST_CUP_AR = "كأس التجربة"

STAGE_NAMES_AR = {
    "Group Stage": "مرحلة المجموعات",
    "Group Stage — Matchday 1": "مرحلة المجموعات — الجولة 1",
    "Group Stage — Matchday 2": "مرحلة المجموعات — الجولة 2",
    "Group Stage — Matchday 3": "مرحلة المجموعات — الجولة 3",
    "Round of 32": "دور الـ32",
    "Round of 16": "دور الـ16",
    "Quarter Finals": "ربع النهائي",
    "Semi Finals": "نصف النهائي",
    "Third Place Match": "مباراة المركز الثالث",
    "Final": "النهائي",
}

TEAM_NAMES_AR = {
    "MEX": "المكسيك",
    "RSA": "جنوب أفريقيا",
    "KOR": "كوريا",
    "CZE": "التشيك",
    "CAN": "كندا",
    "BIH": "البوسنة والهرسك",
    "QAT": "قطر",
    "SUI": "سويسرا",
    "BRA": "البرازيل",
    "MAR": "المغرب",
    "HAI": "هايتي",
    "SCO": "اسكوتلندا",
    "USA": "الولايات المتحدة",
    "PAR": "باراغواي",
    "AUS": "أستراليا",
    "TUR": "تركيا",
    "GER": "ألمانيا",
    "CUW": "كوراساو",
    "CIV": "ساحل العاج",
    "ECU": "الإكوادور",
    "NED": "هولندا",
    "JPN": "اليابان",
    "SWE": "السويد",
    "TUN": "تونس",
    "BEL": "بلجيكا",
    "EGY": "مصر",
    "IRN": "إيران",
    "NZL": "نيوزيلندا",
    "ESP": "إسبانيا",
    "CPV": "الرأس الأخضر",
    "KSA": "السعودية",
    "URU": "أوروغواي",
    "FRA": "فرنسا",
    "SEN": "السنغال",
    "NOR": "النرويج",
    "IRQ": "العراق",
    "ARG": "الأرجنتين",
    "ALG": "الجزائر",
    "AUT": "النمسا",
    "JOR": "الأردن",
    "POR": "البرتغال",
    "COD": "الكونغو الديمقراطية",
    "UZB": "أوزبكستان",
    "COL": "كولومبيا",
    "ENG": "إنجلترا",
    "CRO": "كرواتيا",
    "GHA": "غانا",
    "PAN": "بنما",
}

GROUP_LETTERS_AR = {
    "A": "أ", 
    "B": "ب", 
    "C": "ج", 
    "D": "د", 
    "E": "هـ", 
    "F": "و", 
    "G": "ز", 
    "H": "ح", 
    "I": "ط", 
    "J": "ي", 
    "K": "ك", 
    "L": "ل",
}


def stage_name_ar(name: str) -> str:
    return STAGE_NAMES_AR.get(name, name)


def team_name_ar(code: str, fallback: str) -> str:
    return TEAM_NAMES_AR.get(code, fallback)


def cup_group_name_ar(letter: str) -> str:
    ar_letter = GROUP_LETTERS_AR.get(letter.upper(), letter)
    return f"المجموعة {ar_letter}"
