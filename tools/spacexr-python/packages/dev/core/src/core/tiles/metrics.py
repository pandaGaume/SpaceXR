from typing import Tuple
from ..geography.position import Geo2
from ..geometry.cartesian import Cartesian2
from ..tiles.system import TileSystem, TileSystemBounds

class TileMetrics(TileSystem):

    def __init__(self,  tileSize = TileSystem.DefaultTileSize, 
                    cellSize = TileSystem.DefaultCellSize, 
                    cellCoordinateReference = TileSystem.DefaultCoordinateReference, 
                    minLOD = TileSystemBounds.DefaultMinLOD, 
                    maxLOD = TileSystemBounds.DefaultMaxLOD, 
                    minLatitude = TileSystemBounds.DefaultMinLatitude, 
                    maxLatitude = TileSystemBounds.DefaultMaxLatitude, 
                    minLongitude = TileSystemBounds.DefaultMinLongitude, 
                    maxLongitude = TileSystemBounds.DefaultMaxLongitude):
        super().__init__(tileSize, cellSize, cellCoordinateReference, minLOD, maxLOD, minLatitude, maxLatitude, minLongitude, maxLongitude)

    def mapSize(self, levelOfDetail: int) -> int:
        return self.tileSize << levelOfDetail

    def mapScale(self, latitude: float, levelOfDetail: int, dpi: int) -> float:
        return 1 / (self.groundResolution(latitude, levelOfDetail) * pixelPerUnit)

    def getLatLonToTileXY(self, latitude: float, longitude: float, levelOfDetail: int) -> Cartesian2:
        c = Cartesian2.Zero()
        self.getLatLonToTileXYToRef(latitude, longitude, levelOfDetail, c)
        return c

    def getTileXYToLatLon(self, x: int, y: int, levelOfDetail: int) -> Geo2:
        g = Geo2.Zero()
        this.getTileXYToLatLonToRef(x, y, levelOfDetail, g)
        return g

    def getLatLonToPointXY(self, latitude: float, longitude: float, levelOfDetail: int) -> Cartesian2:
        c = Cartesian2.Zero()
        this.getLatLonToPointXYToRef(latitude, longitude, levelOfDetail, c)
        return c

    def getPointXYToLatLon(self, x: int, y: int, levelOfDetail: int) -> Geo2:
        g = Geo2.Zero()
        this.getPointXYToLatLonToRef(x, y, levelOfDetail, g)
        return g

    def getTileXYToPointXY(self, x: int, y: int) -> Cartesian2:
        c = Cartesian2.Zero()
        this.getTileXYToPointXYToRef(x, y, c)
        return c

    def getPointXYToTileXY(self, x: int, y: int) -> Cartesian2:
        c = Cartesian2.Zero()
        this.getPointXYToTileXYToRef(x, y, c)
        return c

    def groundResolution(self, latitude: float, levelOfDetail: int) -> float:
        pass  # abstract method

    def getLatLonToTileXYToRef(self, latitude: float, longitude: float, levelOfDetail: int, tileXY: Cartesian2 = None) -> None:
        pass  # abstract method

    def getTileXYToLatLonToRef(self, x: int, y: int, levelOfDetail: int, latLon: Geo2 = None) -> None:
        pass  # abstract method

    def getLatLonToPointXYToRef(self, latitude: float, longitude: float, levelOfDetail: int, pointXY: Cartesian2 = None) -> None:
        pass  # abstract method

    def getPointXYToLatLonToRef(self, x: int, y: int, levelOfDetail: int, latLon: Geo2 = None) -> None:
        pass  # abstract method

    def getTileXYToPointXYToRef(self, x: int, y: int, pointXY: Cartesian2 = None) -> None:
        pass  # abstract method

    def getPointXYToTileXYToRef(self, x: int, y: int, tileXY: Cartesian2 = None) -> None:
        pass  # abstract method
