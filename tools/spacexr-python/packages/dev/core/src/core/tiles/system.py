from enum import Enum

class TileSystemBounds:

    DefaultLOD = 0
    DefaultMinLOD = 0
    DefaultMaxLOD = 23
    DefaultMinLatitude = Projections.WebMercatorMinLatitude
    DefaultMaxLatitude = Projections.WebMercatorMaxLatitude
    DefaultMinLongitude = -180
    DefaultMaxLongitude = 180

    def __init__(self, minLOD = DefaultMinLOD, maxLOD = DefaultMaxLOD, minLatitude = DefaultMinLatitude, maxLatitude = DefaultMaxLatitude, minLongitude = DefaultMinLongitude, maxLongitude = DefaultMaxLongitude):
        self.propertyChangedObservable = Observable()
        self.minLOD = minLOD
        self.maxLOD = maxLOD
        self.minLatitude = minLatitude
        self.maxLatitude = maxLatitude
        self.minLongitude = minLongitude
        self.maxLongitude = maxLongitude

    def unionInPlace(self, bounds):
        if bounds:
            self.minLOD = min(self.minLOD, bounds.minLOD)
            self.maxLOD = max(self.maxLOD, bounds.maxLOD)
            self.minLatitude = min(self.minLatitude, bounds.minLatitude)
            self.maxLatitude = max(self.maxLatitude, bounds.maxLatitude)
            self.minLongitude = min(self.minLongitude, bounds.minLongitude)
            self.maxLongitude = max(self.maxLongitude, bounds.maxLongitude)

    def copyInPlace(self, bounds):
        if bounds:
            self.minLOD = bounds.minLOD
            self.maxLOD = bounds.maxLOD
            self.minLatitude = bounds.minLatitude
            self.maxLatitude = bounds.maxLatitude
            self.minLongitude = bounds.minLongitude
            self.maxLongitude = bounds.maxLongitude

class CellCoordinateReference(Enum):
    CENTER = 0,
    NW = 1,
    NE = 2,
    SW = 3,
    SE = 4

class TileSystem(TileSystemBounds):
    DefaultTileSize = 256
    DefaultCellSize = 1
    DefaultCoordinateReference = CellCoordinateReference.CENTER

    def __init__(self,  tileSize = DefaultTileSize, 
                        cellSize = DefaultCellSize, 
                        cellCoordinateReference = DefaultCoordinateReference, 
                        minLOD = TileSystemBounds.DefaultMinLOD, 
                        maxLOD = TileSystemBounds.DefaultMaxLOD, 
                        minLatitude = TileSystemBounds.DefaultMinLatitude, 
                        maxLatitude = TileSystemBounds.DefaultMaxLatitude, 
                        minLongitude = TileSystemBounds.DefaultMinLongitude, 
                        maxLongitude = TileSystemBounds.DefaultMaxLongitude):
        super().__init__(minLOD, maxLOD, minLatitude, maxLatitude, minLongitude, maxLongitude)
        self.tileSize = tileSize
        self.cellSize = cellSize
        self.cellCoordinateReference = cellCoordinateReference
        self.overlap = overlap
