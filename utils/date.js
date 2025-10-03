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
