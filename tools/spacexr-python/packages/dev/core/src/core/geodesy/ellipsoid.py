import math

class Ellipsoid:
    WGS84 = None
    GRS80 = None
    GRS67 = None
    ANS = None
    WGS72 = None
    Clarke1858 = None
    Clarke1880 = None

    def __init__(self, name: str, semiMajor: float, semiMinor: float, flattening: float, inverseFlattening: float):
        self._name = name
        self._a = semiMajor
        self._b = semiMinor
        self._f = flattening
        self._p1mf = 1.0 - self._f
        self._invf = inverseFlattening

        self._aa = self._a ** 2
        self._bb = self._b ** 2
        self._c = math.sqrt(self._aa - self._bb)
        self._ee = 1 - self._bb / self._aa
        self._e = math.sqrt(self._ee)

        self._invaa = 1.0 / self._aa
        self._aadc = self._aa / self._c
        self._bbdcc = self._bb / (self._c ** 2)
        self._l = self._ee / 2
        self._p1mee = 1 - self._ee
        self._p1meedaa = self._p1mee / self._aa
        self._hmin = self._e ** 12 / 4
        self._ll = self._l ** 2
        self._ll4 = self._ll * 4

    @staticmethod
    def FromAAndInverseF(name: str, semiMajor: float, inverseFlattening: float):
        f = 1.0 / inverseFlattening
        b = (1.0 - f) * semiMajor
        return Ellipsoid(name, semiMajor, b, f, inverseFlattening)

    @staticmethod
    def FromAAndF(name: str, semiMajor: float, flattening: float):
        inverseF = 1.0 / flattening
        b = (1.0 - flattening) * semiMajor
        return Ellipsoid(name, semiMajor, b, flattening, inverseF)

    @property
    def name(self) -> str:
        return self._name

    # Additional getters for other attributes

    def isEquals(self, other) -> bool:
        return other and self._a == other._a and self._b == other._b

    def clone(self, name: str, scale=1.0):
        return Ellipsoid(name, self._a * scale, self._b * scale, self._f, self._invf)

# Initialize the predefined ellipsoids
Ellipsoid.WGS84 = Ellipsoid.FromAAndInverseF("WGS84", 6378137.0, 298.257223563)
Ellipsoid.GRS80 = Ellipsoid.FromAAndInverseF("GRS80", 6378137.0, 298.257222101)
Ellipsoid.GRS67 = Ellipsoid.FromAAndInverseF("GRS67", 6378160.0, 298.25)
Ellipsoid.ANS = Ellipsoid.FromAAndInverseF("ANS", 6378160.0, 298.25)
Ellipsoid.WGS72 = Ellipsoid.FromAAndInverseF("WGS72", 6378135.0, 298.26)
Ellipsoid.Clarke1858 = Ellipsoid.FromAAndInverseF("Clarke1858", 6378293.645, 294.26)
Ellipsoid.Clarke1880 = Ellipsoid.FromAAndInverseF("Clarke1880", 6378249.145, 293.465)
