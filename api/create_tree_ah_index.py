import os
from google.cloud import aiplatform

aiplatform.init(
    project=os.environ["PROJECT_ID"],
    location=os.environ["REGION"],
)

index = aiplatform.MatchingEngineIndex.create_tree_ah_index(
    display_name=os.environ["INDEX_DISPLAY_NAME"],
    contents_delta_uri=os.environ["EMBEDDINGS_URI"],
    dimensions=int(os.environ["DIMENSIONS"]),
    approximate_neighbors_count=int(os.environ["APPROX_NEIGHBORS"]),
    leaf_node_embedding_count=int(os.environ["LEAF_NODE_EMBEDDING_COUNT"]),
    leaf_nodes_to_search_percent=int(os.environ["LEAF_NODES_TO_SEARCH_PERCENT"]),
    distance_measure_type=os.environ["DISTANCE_MEASURE"],
    index_update_method=os.environ["UPDATE_METHOD"],
)

print(index.resource_name)
