using UnityEngine;

public class TelemetryManager : MonoBehaviour
{
    private static TelemetryManager _instance;
    public static TelemetryManager Instance => _instance;

    private void Awake()
    {
        if (_instance != null && _instance != this)
        {
            Destroy(gameObject);
            return;
        }

        _instance = this;
        DontDestroyOnLoad(gameObject);
    }

    // Milestone 1: App Launch & Handshake
    public void SendInitHandshake()
    {
        Debug.Log("[Telemetry] M1 - init_handshake | lifecycle = initializing");
    }

    // Milestone 2: Profile & Identity Anchoring
    public void SendProfileAnchoring()
    {
        Debug.Log("[Telemetry] M2 - profile_anchor | lifecycle = active");
    }

    // Milestone 3: Core Tutorial & Asset Deployment
    public void SendAssetDeployment()
    {
        Debug.Log("[Telemetry] M3 - asset_deploy | structure_deployed");
    }

    // Milestone 4: Automated Harvesting & Stress-Test
    public void SendHarvestCycle()
    {
        Debug.Log("[Telemetry] M4 - harvest_cycle | high-frequency events");
    }
}