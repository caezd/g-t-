export const getDateWeek = (date) => {
    const currentDate = typeof date === "object" ? date : new Date();
    const januaryFirst = new Date(currentDate.getFullYear(), 0, 1);
    const daysToNextMonday =
        januaryFirst.getDay() === 1 ? 0 : (7 - januaryFirst.getDay()) % 7;
    const nextMonday = new Date(
        currentDate.getFullYear(),
        0,
        januaryFirst.getDate() + daysToNextMonday
    );

    return currentDate < nextMonday
        ? 52
        : currentDate > nextMonday
        ? Math.ceil((currentDate - nextMonday) / (24 * 3600 * 1000) / 7)
        : 1;
};

/* How to get first and last day of the current week in JavaScript */
export const weekRange = (date) => {
    var curr = new Date(); // get current date
    var first = curr.getDate() - curr.getDay(); // First day is the day of the month - the day of the week
    var last = first + 6; // last day is the first day + 6

    return {
        first: new Date(curr.setDate(first)),
        last: new Date(curr.setDate(last)),
    };
};

export function FormatDecimalsToHours(floatHours) {
    if (floatHours == null || Number.isNaN(floatHours)) return "";
    const hours = Math.trunc(floatHours);
    const minutes = Math.round((floatHours - hours) * 60);
    return `${hours}h${minutes.toString().padStart(2, "0")}`;
}

export function toHoursDecimal(input) {
    if (input == null || input === "") return undefined;
    if (typeof input === "number" && !Number.isNaN(input)) return input;

    const raw = String(input).trim().toLowerCase();

    // Normaliser la virgule décimale -> point
    const s = raw.replace(",", ".");

    // cas "1.5h" ou "1.5" (heures décimales)
    let m = s.match(/^(-?\d+(?:\.\d+)?)\s*h?$/);
    if (m) return Number(m[1]);

    // cas "1h30" (ou "2h05")
    m = s.match(/^(-?\d+)\s*h\s*(\d{1,2})$/);
    if (m) {
        const h = Number(m[1]);
        const minutes = Number(m[2]);
        return h + minutes / 60;
    }

    // cas "1:30"
    m = s.match(/^(-?\d+)\s*:\s*(\d{1,2})$/);
    if (m) {
        const h = Number(m[1]);
        const minutes = Number(m[2]);
        return h + minutes / 60;
    }

    // cas "90m", "45 min", "30mins"
    m = s.match(/^(-?\d+(?:\.\d+)?)\s*m(?:in(?:s)?)?$/);
    if (m) {
        const minutes = Number(m[1]);
        return minutes / 60;
    }

    // Rien de reconnu
    return undefined;
}
