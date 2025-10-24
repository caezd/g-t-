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
    const v = Number(floatHours);
    if (!isFinite(v)) return ""; // gère null/NaN/Infinity

    const sign = v < 0 ? "-" : "";

    // Convertir tout en minutes pour éviter les surprises d'arrondi
    const totalMin = Math.round(Math.abs(v) * 60);

    const hours = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;

    return `${sign}${hours}h${minutes.toString().padStart(2, "0")}`;
}

export function toHoursDecimal(input) {
    if (typeof input === "number") return input;
    if (!input) return NaN;
    const s = String(input).trim().toLowerCase().replace(",", "."); // 1,5 -> 1.5
    // "90m"
    const m = s.match(/^(\d+(?:\.\d+)?)\s*m(in)?$/);
    if (m) return Number(m[1]) / 60;

    // "1h30" / "1 h 30"
    const hMatch = s.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2}))?$/);
    if (hMatch) {
        const h = Number(hMatch[1]);
        const mins = hMatch[2] ? Number(hMatch[2]) : 0;
        return h + mins / 60;
    }

    // "1:30"
    const cMatch = s.match(/^(\d+):(\d{1,2})$/);
    if (cMatch) {
        const h = Number(cMatch[1]);
        const mins = Number(cMatch[2]);
        return h + mins / 60;
    }

    // "1.5" (déjà décimal)
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
}

export function formatHoursHuman(decimal) {
    if (decimal == null || Number.isNaN(decimal)) return "";
    const minsTotal = Math.round(decimal * 60);
    const h = Math.floor(minsTotal / 60);
    const m = minsTotal % 60;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, "0")}`;
}

export function startOfWeekSunday(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0 = dimanche
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d;
}
export function endOfWeekSaturday(date) {
    const start = startOfWeekSunday(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
}

export function dateAtNoonLocal(d) {
    const nd = new Date(d);
    nd.setHours(12, 0, 0, 0);
    return nd;
}
export function ymdFromDate(d) {
    return d ? d.toISOString().slice(0, 10) : "";
}
