using UnityEngine;
using System.Collections;

public class OnboardingController : MonoBehaviour
{
    private IEnumerator Start()
    {
        if (TelemetryManager.Instance == null)
        {
            Debug.LogError("TelemetryManager.Instance is null. Make sure TelemetryManager is in the scene.");
            yield break;
        }

        // Milestone 1: App Launch & Handshake
        TelemetryManager.Instance.SendInitHandshake();
        yield return new WaitForSeconds(2f);

        // Milestone 2: Profile & Identity Anchoring
        TelemetryManager.Instance.SendProfileAnchoring();
        yield return new WaitForSeconds(2f);

        // Milestone 3: Core Tutorial & Asset Deployment
        TelemetryManager.Instance.SendAssetDeployment();
        yield return new WaitForSeconds(2f);

        // Milestone 4: Automated Harvesting & Stress-Test
        TelemetryManager.Instance.SendHarvestCycle();
    }
}