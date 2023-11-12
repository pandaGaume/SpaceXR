export class CelestialCoordinates {
    public static GetJulianDate(date: Date): number {
        // The date.getUTCHours() method returns the hours in the specified date according to universal time,
        // and the getUTCMinutes(), getUTCSeconds(), and getUTCMilliseconds() do the same for their respective units.
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
        const milliseconds = date.getUTCMilliseconds();

        // Calculate the additional Julian Day fraction for the time of day
        // UTC time is used here to comply with the standard definition of Julian Date
        const dayFraction = (hours + minutes / 60 + seconds / 3600 + milliseconds / 3600000) / 24;

        // Get the date components
        let year = date.getUTCFullYear();
        let month = date.getUTCMonth() + 1; // getUTCMonth() returns 0 for January, 1 for February, etc.
        let day = date.getUTCDate();

        // Adjust the month and year if necessary
        if (month < 3) {
            year--;
            month += 12;
        }

        // Calculate the Julian Day Number (integer part)
        const A = Math.floor(year / 100);
        const B = 2 - A + Math.floor(A / 4);
        const JDN = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;

        // Return the Julian Day Number plus the day fraction
        return JDN + dayFraction;
    }

    public static GetSolarDeclination(julianDate: number): number {
        // Constants
        const eclipticLongitudeEpoch = 280.46646; // degrees
        const perihelion = 102.9372; // degrees
        const obliquity = 23.44; // Earth's axial tilt in degrees

        // Days since J2000.0
        const n = julianDate - 2451545.0;

        // Mean anomaly
        const meanAnomaly = 357.52911 + 0.98560028 * n;

        // Equation of the center
        const equationOfCenter = 1.914602 - 0.004817 * n - 0.000014 * Math.pow(n, 2);
        const trueAnomaly = meanAnomaly + equationOfCenter;

        // Ecliptic longitude
        const eclipticLongitude = (eclipticLongitudeEpoch + trueAnomaly + perihelion + 180) % 360;

        // Solar declination
        const declination = Math.asin(Math.sin(obliquity * (Math.PI / 180)) * Math.sin(eclipticLongitude * (Math.PI / 180))) * (180 / Math.PI); // Convert from radians to degrees

        return declination;
    }

    public static GetSolarAzimuth(declination: number, latitude: number, longitude: number, currentTime: Date): number {
        // Calculate time in hours since midnight for the given time
        const hoursSinceMidnight = currentTime.getUTCHours() + currentTime.getUTCMinutes() / 60 + currentTime.getUTCSeconds() / 3600;

        // Calculate the solar hour angle
        const solarTime = hoursSinceMidnight + longitude / 15;
        const hourAngle = (solarTime - 12) * 15; // degrees

        // Convert all angles to radians for calculation
        const latRad = latitude * (Math.PI / 180);
        const declRad = declination * (Math.PI / 180);
        const hourAngleRad = hourAngle * (Math.PI / 180);

        // Calculate solar altitude angle
        const altitude = Math.asin(Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad));

        // Calculate solar azimuth angle
        const azimuth = Math.acos((Math.sin(declRad) - Math.sin(altitude) * Math.sin(latRad)) / (Math.cos(altitude) * Math.cos(latRad)));

        // Convert azimuth from radians to degrees
        const azimuthDeg = azimuth * (180 / Math.PI);

        // Adjust azimuth based on the hour angle
        return hourAngle > 0 ? azimuthDeg : 360 - azimuthDeg;
    }
}
