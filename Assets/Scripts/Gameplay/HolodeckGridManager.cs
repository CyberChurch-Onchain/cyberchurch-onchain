using System.Collections.Generic;
using UnityEngine;

public class HolodeckGridManager : MonoBehaviour
{
    private static HolodeckGridManager _instance;
    public static HolodeckGridManager Instance => _instance;

    private readonly Dictionary<Vector3Int, NodeMover> _grid =
        new Dictionary<Vector3Int, NodeMover>();

    [SerializeField] private int maxExpectedNodes = 1000;

    private void Awake()
    {
        if (_instance != null && _instance != this)
        {
            Destroy(gameObject);
            return;
        }

        _instance = this;
        DontDestroyOnLoad(gameObject);

        _grid.EnsureCapacity(maxExpectedNodes);
    }

    public void RegisterNode(NodeMover node, Vector3Int cell)
    {
        if (_grid.TryGetValue(cell, out NodeMover existing) && existing != node)
        {
            Debug.LogWarning($"[Grid] Cell {cell} already occupied by {existing.name}, replacing with {node.name}");
            _grid[cell] = node;
        }
        else
        {
            _grid[cell] = node;
        }
    }

    public bool TryGetNodeAtCell(Vector3Int cell, out NodeMover node)
    {
        return _grid.TryGetValue(cell, out node);
    }

    public int NodeCount => _grid.Count;
}