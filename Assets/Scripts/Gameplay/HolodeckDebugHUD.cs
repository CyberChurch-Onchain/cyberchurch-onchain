using UnityEngine;

public class HolodeckDebugHUD : MonoBehaviour
{
    private float _deltaTime;

    private void Update()
    {
        _deltaTime += (Time.unscaledDeltaTime - _deltaTime) * 0.1f;
    }

    private void OnGUI()
    {
        int w = Screen.width, h = Screen.height;

        GUIStyle style = new GUIStyle();
        Rect rect = new Rect(10, 10, w, h * 2 / 100);
        style.alignment = TextAnchor.UpperLeft;
        style.fontSize = h * 2 / 50;
        style.normal.textColor = Color.white;

        float fps = 1.0f / _deltaTime;
        int nodeCount = HolodeckGridManager.Instance != null
            ? HolodeckGridManager.Instance.NodeCount
            : 0;

        string text = $"FPS: {fps:0.}   Nodes: {nodeCount}";
        GUI.Label(rect, text, style);
    }
}