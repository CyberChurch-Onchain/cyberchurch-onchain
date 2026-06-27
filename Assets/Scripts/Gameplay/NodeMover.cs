using UnityEngine;

[RequireComponent(typeof(Collider))]
public class NodeMover : MonoBehaviour
{
    [SerializeField] private float moveHeight = 0.5f;   // keep it above grid
    [SerializeField] private float cellSize = 1f;

    private bool isDragging;
    private Camera mainCamera;

    private void Awake()
    {
        mainCamera = Camera.main;
    }

    private void OnMouseDown()
    {
        isDragging = true;
    }

    private void OnMouseUp()
    {
        isDragging = false;
        SnapToGrid();
    }

    private void Update()
    {
        if (!isDragging || mainCamera == null) return;

        Ray ray = mainCamera.ScreenPointToRay(Input.mousePosition);
        if (Physics.Raycast(ray, out RaycastHit hit, 100f))
        {
            Vector3 rawPos = hit.point;
            rawPos.y = moveHeight;  // keep it on a plane
            transform.position = rawPos;

            Debug.Log($"[Node] Floating state position = {rawPos}");
        }
    }

    private void SnapToGrid()
    {
        Vector3 pos = transform.position;

        int cellX = Mathf.RoundToInt(pos.x / cellSize);
        int cellY = Mathf.RoundToInt(pos.y / cellSize);
        int cellZ = Mathf.RoundToInt(pos.z / cellSize);

        Vector3 snapped = new Vector3(
            cellX * cellSize,
            cellY * cellSize,
            cellZ * cellSize
        );

        transform.position = snapped;

        Vector3Int cellCoords = new Vector3Int(cellX, cellY, cellZ);
        Debug.Log($"[Node] Snapped to cell {cellCoords}");

        // Will enable once GridManager exists:
        HolodeckGridManager.Instance.RegisterNode(this, cellCoords);
    }
}