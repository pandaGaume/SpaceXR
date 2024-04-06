class Geo2:
    
    @staticmethod
    def Zero() -> Geo2: # No quotes needed since Geo2 is already defined
        return Geo2(0, 0)
        
    def __init__(self, lat: float = 0 , lon: float = 0):
        self.lat = lat
        self.lon = lon

    def __str__(self) -> str:
        return f"({self.lat}, {self.lon})"