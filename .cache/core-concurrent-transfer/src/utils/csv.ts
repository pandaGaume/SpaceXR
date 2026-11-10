export class CSVParser {
    private delimiter: string;

    public constructor(delimiter = ",") {
        this.delimiter = delimiter;
    }

    public parse(csv: string): string[][] {
        const lines = csv.trim().split(/\r?\n/);
        return lines.map((line) => this.parseLine(line));
    }

    private parseLine(line: string): string[] {
        const cells = [];
        let cell = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cell += '"';
                    i++; // skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === this.delimiter && !inQuotes) {
                cells.push(cell);
                cell = "";
            } else {
                cell += char;
            }
        }

        cells.push(cell);
        return cells;
    }
}
