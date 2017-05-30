angular.module('home').controller('SearchController', ['$scope', 'SearchService','$routeParams', '$http',
    function ($scope,SearchService , $routeParams, $http) {//SearchService

        $scope.onSearch = function () {
            if ($scope.search != "") {
                SearchService.get($scope.search).then(function successCallback(response) {
                    $scope.contents = response.data
                    console.debug(response)
                }, function errorCallback(response) {
                    console.debug(response)
                })
            } else {
                $scope.contents = []
            }
        }
    }
]);