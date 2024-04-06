
class Cartesian2:

    @staticmethod
    def Zero() -> Cartesian2: # No quotes needed since Cartesian2 is already defined
        return Cartesian2(0, 0)

    def __init__(self, x: float = 0 , y: float = 0):
        self.x = x
        self.y = y

    def __str__(self) -> str:
        return f"({self.x}, {self.y})"
