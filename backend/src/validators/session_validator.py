from math import isfinite


def validate_coordinates(coordinates):
    """
    Validate a spatial coordinate represented as [x, y, z].

    Returns:
        True if the coordinate is valid.
        False otherwise.
    """
    if not isinstance(coordinates, (list, tuple)):
        return False

    if len(coordinates) != 3:
        return False

    for value in coordinates:
        if isinstance(value, bool):
            return False

        if not isinstance(value, (int, float)):
            return False

        if not isfinite(value):
            return False

    return True