"""Small dependency-free dense linear algebra helpers.

Structural model sizes handled by this service foundation are intentionally
small. A sparse backend can later implement the same solver interface.
"""

from __future__ import annotations


def solve_linear_system(matrix: list[list[float]], vector: list[float], *, tolerance: float = 1e-12) -> list[float]:
    size = len(vector)
    if len(matrix) != size or any(len(row) != size for row in matrix):
        raise ValueError("Linear system must be square")
    augmented = [list(map(float, row)) + [float(vector[index])] for index, row in enumerate(matrix)]
    for pivot_index in range(size):
        selected = max(range(pivot_index, size), key=lambda row: abs(augmented[row][pivot_index]))
        if abs(augmented[selected][pivot_index]) <= tolerance:
            raise ValueError("Structural stiffness matrix is singular; check supports and releases")
        augmented[pivot_index], augmented[selected] = augmented[selected], augmented[pivot_index]
        pivot = augmented[pivot_index][pivot_index]
        augmented[pivot_index] = [value / pivot for value in augmented[pivot_index]]
        for row in range(size):
            if row == pivot_index:
                continue
            factor = augmented[row][pivot_index]
            if abs(factor) <= tolerance:
                continue
            augmented[row] = [
                value - factor * pivot_value
                for value, pivot_value in zip(augmented[row], augmented[pivot_index], strict=True)
            ]
    return [row[-1] for row in augmented]
