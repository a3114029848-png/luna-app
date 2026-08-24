if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "E:/gradle-home/caches/9.3.1/transforms/09e67ac42fe00929cdf7c316b1464038/workspace/transformed/hermes-android-250829098.0.14-debug/prefab/modules/hermesvm/libs/android.arm64-v8a/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "E:/gradle-home/caches/9.3.1/transforms/09e67ac42fe00929cdf7c316b1464038/workspace/transformed/hermes-android-250829098.0.14-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

