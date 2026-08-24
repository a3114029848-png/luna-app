if(NOT TARGET ReactAndroid::hermestooling)
add_library(ReactAndroid::hermestooling SHARED IMPORTED)
set_target_properties(ReactAndroid::hermestooling PROPERTIES
    IMPORTED_LOCATION "E:/gradle-home/caches/9.3.1/transforms/2b7c23aa4547eb79508e5d3aa3f2bc7a/workspace/transformed/react-android-0.86.0-debug/prefab/modules/hermestooling/libs/android.armeabi-v7a/libhermestooling.so"
    INTERFACE_INCLUDE_DIRECTORIES "E:/gradle-home/caches/9.3.1/transforms/2b7c23aa4547eb79508e5d3aa3f2bc7a/workspace/transformed/react-android-0.86.0-debug/prefab/modules/hermestooling/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::jsi)
add_library(ReactAndroid::jsi SHARED IMPORTED)
set_target_properties(ReactAndroid::jsi PROPERTIES
    IMPORTED_LOCATION "E:/gradle-home/caches/9.3.1/transforms/2b7c23aa4547eb79508e5d3aa3f2bc7a/workspace/transformed/react-android-0.86.0-debug/prefab/modules/jsi/libs/android.armeabi-v7a/libjsi.so"
    INTERFACE_INCLUDE_DIRECTORIES "E:/gradle-home/caches/9.3.1/transforms/2b7c23aa4547eb79508e5d3aa3f2bc7a/workspace/transformed/react-android-0.86.0-debug/prefab/modules/jsi/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

if(NOT TARGET ReactAndroid::reactnative)
add_library(ReactAndroid::reactnative SHARED IMPORTED)
set_target_properties(ReactAndroid::reactnative PROPERTIES
    IMPORTED_LOCATION "E:/gradle-home/caches/9.3.1/transforms/2b7c23aa4547eb79508e5d3aa3f2bc7a/workspace/transformed/react-android-0.86.0-debug/prefab/modules/reactnative/libs/android.armeabi-v7a/libreactnative.so"
    INTERFACE_INCLUDE_DIRECTORIES "E:/gradle-home/caches/9.3.1/transforms/2b7c23aa4547eb79508e5d3aa3f2bc7a/workspace/transformed/react-android-0.86.0-debug/prefab/modules/reactnative/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

