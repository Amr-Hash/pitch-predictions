from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class OptionalPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200

    def paginate_queryset(self, queryset, request, view=None):
        if request.user.is_staff and request.query_params.get("page_size") == "all":
            return None
        return super().paginate_queryset(queryset, request, view)
