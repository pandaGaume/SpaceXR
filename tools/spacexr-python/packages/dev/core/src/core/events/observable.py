class Observable:
    def __init__(self):
        self._observers = []

    def subscribe(self, observer):
        self._observers.append(observer)

    def notify(self, *args, **kwargs):
        """
        Sends a notification with arbitrary positional and keyword arguments.

        This method is designed to accept a flexible number of arguments, making it
        suitable for various notification types where the required data might vary.

        Args:
            *args: A tuple of positional arguments that can be used to pass
                   unspecified numbers of arguments to the function.

            **kwargs: A dictionary of keyword arguments. This allows for passing
                      named arguments that have not been explicitly defined in
                      the method's signature.

        Example:
            notifier.notify(1, 2, 3, message="Hello", recipient="World")

        This would output:
            Args: (1, 2, 3)
            Keyword Args: {'message': 'Hello', 'recipient': 'World'}
        """
        for observer in self._observers:
            observer(*args, **kwargs)
