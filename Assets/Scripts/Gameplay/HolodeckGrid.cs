using UnityEngine;

public class HolodeckGrid : MonoBehaviour
{
    [SerializeField] private int sizeX = 10;
    [SerializeField] private int sizeZ = 10;
    [SerializeField] private float cellSize = 1f;
    [SerializeField] private Color gridColor = Color.cyan;

    private void OnDrawGizmos()
    {
        Gizmos.color = gridColor;

        for (int x = -sizeX; x <= sizeX; x++)
        {
            Vector3 from = new Vector3(x * cellSize, 0, -sizeZ * cellSize);
            Vector3 to   = new Vector3(x * cellSize, 0,  sizeZ * cellSize);
            Gizmos.DrawLine(from, to);
        }

        for (int z = -sizeZ; z <= sizeZ; z++)
        {
            Vector3 from = new Vector3(-sizeX * cellSize, 0, z * cellSize);
            Vector3 to   = new Vector3( sizeX * cellSize, 0, z * cellSize);
            Gizmos.DrawLine(from, to);
        }
    }
}