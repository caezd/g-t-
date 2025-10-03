import { useState, useEffect } from "react";

export function useTimeInput(initialDecimalValue: string) {
    const [displayValue, setDisplayValue] = useState("");
    const [decimalValue, setDecimalValue] = useState(initialDecimalValue);

    // Décimal → Format heure
    useEffect(() => {
        if (decimalValue) {
            const decimal = parseFloat(decimalValue);
            if (!isNaN(decimal)) {
                const hours = Math.floor(decimal);
                const minutes = Math.round((decimal - hours) * 60);
                setDisplayValue(
                    minutes > 0 ? `${hours}h${minutes}` : `${hours}h`
                );
            }
        } else {
            setDisplayValue("");
        }
    }, [decimalValue]);

    // Heure → Décimal
    const handleTimeChange = (timeString: string) => {
        setDisplayValue(timeString);

        if (timeString.includes("h")) {
            const [hoursStr, minutesStr] = timeString.split("h");
            const hours = parseInt(hoursStr) || 0;
            const minutes = parseInt(minutesStr) || 0;

            if (!isNaN(hours) && !isNaN(minutes)) {
                const decimal = hours + minutes / 60;
                setDecimalValue(decimal.toFixed(2));
            }
        } else if (timeString) {
            const decimal = parseFloat(timeString);
            if (!isNaN(decimal)) {
                setDecimalValue(decimal.toFixed(2));
            }
        } else {
            setDecimalValue("");
        }
    };

    return {
        displayValue,
        decimalValue,
        handleTimeChange,
    };
}
