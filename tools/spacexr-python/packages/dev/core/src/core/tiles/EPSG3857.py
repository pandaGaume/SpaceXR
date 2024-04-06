import math

from ..tiles.metrics import TileMetrics
from ..tiles.system import TileSystem, TileSystemBounds
from ..geodesy.ellipsoid import Ellipsoid
from ..math.scalar import Scalar

class EPSG3857(TileMetrics):

    Shared: EPSG3857 = EPSG3857()

    def __init__(self, ellipsoid:Ellipsoid = none, tileSize = TileSystem.DefaultTileSize, 
                    cellSize = TileSystem.DefaultCellSize, 
                    cellCoordinateReference = TileSystem.DefaultCoordinateReference, 
                    minLOD = TileSystemBounds.DefaultMinLOD, 
                    maxLOD = TileSystemBounds.DefaultMaxLOD, 
                    minLatitude = TileSystemBounds.DefaultMinLatitude, 
                    maxLatitude = TileSystemBounds.DefaultMaxLatitude, 
                    minLongitude = TileSystemBounds.DefaultMinLongitude, 
                    maxLongitude = TileSystemBounds.DefaultMaxLongitude):
        super().__init__(tileSize, cellSize, cellCoordinateReference, minLOD, maxLOD, minLatitude, maxLatitude, minLongitude, maxLongitude)
        if(ellipsoid is None):
            ellipsoid = Ellipsoid.WGS84
        self._ellipsoid = ellipsoid

    def groundResolution(self, latitude, levelOfDetail):
        latitude = scalar.clamp(latitude, self.minLatitude, self.maxLatitude)
        return (math.cos(latitude * Scalar.DEG2RAD) * 2 * math.pi * self.ellipsoid.semiMajorAxis) / self.mapSize(levelOfDetail)

    def getLatLonToTileXYToRef(self, latitude, longitude, levelOfDetail, tileXY=None):
        if not tileXY:
            return
        latitude = scalar.clamp(latitude, self.minLatitude, self.maxLatitude)
        longitude = scalar.clamp(longitude, self.minLongitude, self.maxLongitude)

        n = 2 ** levelOfDetail
        x = int(((longitude + 180) / 360) * n)
        lat_rad = latitude * Scalar.DEG2RAD
        y = int(((1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2) * n)
        tileXY.x = x
        tileXY.y = y

    def getTileXYToLatLonToRef(self, x, y, levelOfDetail, loc=None):
        if not loc:
            return

        n = 2 ** levelOfDetail
        lon = -180 + (x / n) * 360
        n = math.pi - (2 * math.pi * y) / n
        lat = (180 / math.pi) * math.atan(0.5 * (math.exp(n) - math.exp(-n)))

        loc.lat = lat
        loc.lon = lon

    def getLatLonToPointXYToRef(self, latitude, longitude, levelOfDetail, pointXY):
        if not pointXY:
            return
        latitude = scalar.clamp(latitude, self.minLatitude, self.maxLatitude)
        longitude = scalar.clamp(longitude, self.minLongitude, self.maxLongitude)

        x = (longitude + 180) / 360
        sinLatitude = math.sin(latitude * SCALAR.DEG2RAD)
        y = 0.5 - math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * math.pi)

        mapSize = self.mapSize(levelOfDetail)
        pointXY.x = int(round(scalar.clamp(x * mapSize + 0.5, 0, mapSize - 1)))
        pointXY.y = int(round(scalar.clamp(y * mapSize + 0.5, 0, mapSize - 1)))

    def getPointXYToLatLonToRef(self, pointX, pointY, levelOfDetail, latLon=None):
        if not latLon:
            return

        mapSize = self.mapSize(levelOfDetail)
        x = scalar.clamp(pointX, 0, mapSize - 1) / mapSize - 0.5
        y = 0.5 - scalar.clamp(pointY, 0, mapSize - 1) / mapSize

        latLon.lat = 90 - (360 * math.atan(math.exp(-y * 2 * math.pi))) / math.pi
        latLon.lon = 360 * x
        