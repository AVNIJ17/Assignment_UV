from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import TicketViewSet, bootstrap

router = DefaultRouter()
router.register("tickets", TicketViewSet, basename="ticket")

urlpatterns = [
    path("bootstrap/", bootstrap, name="bootstrap"),
    path("", include(router.urls)),
]
