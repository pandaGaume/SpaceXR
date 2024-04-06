class Scalar:
    DEG2RAD = math.pi / 180

    @staticmethod
    def clamp(value, min_value, max_value):
        return max(min_value, min(value, max_value))

