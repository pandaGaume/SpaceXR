
class PropertyChangedEventArgs:
    def __init__(self, source, property_name, value):
        self.source = source
        self.property_name = property_name
        self.value = value