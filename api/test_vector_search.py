import os
import statistics
import time
from google.cloud import aiplatform

PROJECT_ID = os.environ["PROJECT_ID"]
REGION = os.environ["REGION"]
ENDPOINT_RESOURCE_NAME = os.environ["ENDPOINT_RESOURCE_NAME"]
DEPLOYED_INDEX_ID = os.environ["DEPLOYED_INDEX_ID"]

DIMENSIONS = 768
NUM_NEIGHBORS = 3
REQUEST_COUNT = 5

query = [0.0] * DIMENSIONS
query[0] = 1.0

if len(query) != DIMENSIONS:
    raise RuntimeError(
        f"Query has {len(query)} dimensions; expected {DIMENSIONS}"
    )

aiplatform.init(
    project=PROJECT_ID,
    location=REGION,
)

endpoint = aiplatform.MatchingEngineIndexEndpoint(
    ENDPOINT_RESOURCE_NAME
)

latencies_ms = []
responses = []

for request_number in range(1, REQUEST_COUNT + 1):
    start = time.perf_counter()

    result = endpoint.find_neighbors(
        deployed_index_id=DEPLOYED_INDEX_ID,
        queries=[query],
        num_neighbors=NUM_NEIGHBORS,
    )

    elapsed_ms = (time.perf_counter() - start) * 1000
    latencies_ms.append(elapsed_ms)
    responses.append(result)

    print(f"Request {request_number}: {elapsed_ms:.2f} ms")

print()
print(f"Query dimensions: {DIMENSIONS}")
print(f"Requests completed: {REQUEST_COUNT}")
print(f"Minimum latency: {min(latencies_ms):.2f} ms")
print(f"Maximum latency: {max(latencies_ms):.2f} ms")
print(f"Average latency: {statistics.mean(latencies_ms):.2f} ms")

print()
print("Nearest neighbors from the final request:")

for neighbor in responses[-1][0]:
    print(f"  ID: {neighbor.id}, Distance: {neighbor.distance}")
